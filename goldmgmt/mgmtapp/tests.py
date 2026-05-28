from django.contrib.auth import get_user_model
from django.test import TestCase
from django.core.exceptions import ValidationError
from rest_framework.test import APIRequestFactory

from .models import Department, DepartmentRecord, FieldDefinition, MeltingLot, MetalReceipt, MetalReceiptReplica, ParentLot, Process, Product, Purity
from .serializers import DepartmentRecordSerializer, MeltingLotSerializer


class MgmtModelTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(
            username='tester',
            password='tester12345',
        )

    def test_process_sequence_auto_increments_per_product(self):
        product = Product.objects.create(product_name='Gold Ring', user=self.user)
        first = Process.objects.create(product=product, process_name='Casting', user=self.user)
        second = Process.objects.create(product=product, process_name='Polishing', user=self.user)

        self.assertTrue(product.is_active)
        self.assertTrue(first.is_active)
        self.assertTrue(second.is_active)
        self.assertEqual(first.sequence, 1)
        self.assertEqual(second.sequence, 2)

    def test_department_creation_for_process_with_fields(self):
        product = Product.objects.create(product_name='Gold Chain', user=self.user)
        process = Process.objects.create(product=product, process_name='Molding', user=self.user)
        first_field = FieldDefinition.objects.create(field_name='Karigar', field_type='text', user=self.user)
        second_field = FieldDefinition.objects.create(field_name='Loss', field_type='number', user=self.user)

        department = Department.objects.create(process=process, department_name='Melting Entry')
        department.fields.add(first_field, second_field)

        self.assertEqual(department.process, process)
        self.assertEqual(department.department_name, 'Melting Entry')
        self.assertEqual(department.fields.count(), 2)

    def test_parent_lot_name_auto_generates(self):
        product = Product.objects.create(product_name='Gold Bangle', user=self.user)
        purity = Purity.objects.create(purity_value=91.6, user=self.user)

        parent_lot = ParentLot.objects.create(
            product=product,
            purity=purity,
            user=self.user,
        )

        self.assertTrue(parent_lot.name.startswith('PL-'))
        self.assertTrue(parent_lot.is_active)

    def test_melting_lot_formula_and_name_auto_generates(self):
        product = Product.objects.create(product_name='Gold Coin', user=self.user)
        purity = Purity.objects.create(purity_value=91.6, user=self.user)
        parent_lot = ParentLot.objects.create(product=product, purity=purity, user=self.user)
        metal_receipt = MetalReceipt.objects.create(
            accounts='Account A',
            type='Receipt',
            description='Source batch',
            melting_purity=99.5,
            in_weight=100.0,
            user=self.user,
        )
        replica = metal_receipt.replica

        melting_lot = MeltingLot.objects.create(
            metal_receipt_replica=replica,
            purity=purity,
            description='Test melt',
            hook_purity=5.5,
            required_weight=10.0,
            user=self.user,
        )
        melting_lot.products.add(product)
        melting_lot.parent_lots.add(parent_lot)
        metal_receipt.refresh_from_db()
        replica.refresh_from_db()

        self.assertTrue(metal_receipt.receipt_no.startswith('MR-'))
        self.assertTrue(melting_lot.name.startswith('ML-'))
        self.assertGreater(melting_lot.require_alloy_weight, 0)
        self.assertEqual(metal_receipt.in_weight, 100.0)
        self.assertEqual(metal_receipt.out_weight, 10.0)
        self.assertEqual(metal_receipt.balance_weight, 90.0)
        self.assertEqual(replica.in_weight, 90.0)
        self.assertEqual(replica.balance_weight, 90.0)

    def test_metal_receipt_out_weight_tracks_replica_linked_melting_lots(self):
        product = Product.objects.create(product_name='Gold Coin 2', user=self.user)
        purity = Purity.objects.create(purity_value=91.6, user=self.user)
        metal_receipt = MetalReceipt.objects.create(
            accounts='Account A2',
            type='Receipt',
            description='Source batch 2',
            melting_purity=99.5,
            in_weight=120.0,
            user=self.user,
        )

        melting_lot = MeltingLot.objects.create(
            metal_receipt_replica=metal_receipt.replica,
            purity=purity,
            description='Replica usage test',
            hook_purity=5.5,
            required_weight=15.0,
            user=self.user,
        )
        melting_lot.products.add(product)
        metal_receipt.refresh_from_db()

        self.assertEqual(metal_receipt.out_weight, 15.0)
        self.assertEqual(metal_receipt.balance_weight, 105.0)

    def test_melting_lot_can_be_created_with_multiple_receipts(self):
        product = Product.objects.create(product_name='Gold Coin Multi', user=self.user)
        purity = Purity.objects.create(purity_value=91.6, user=self.user)
        first_receipt = MetalReceipt.objects.create(
            accounts='Account M1',
            type='Receipt',
            description='Source batch M1',
            melting_purity=99.5,
            in_weight=100.0,
            user=self.user,
        )
        second_receipt = MetalReceipt.objects.create(
            accounts='Account M2',
            type='Receipt',
            description='Source batch M2',
            melting_purity=95.0,
            in_weight=80.0,
            user=self.user,
        )

        factory = APIRequestFactory()
        request = factory.post('/api/mgmt/melting-lots/')
        request.user = self.user
        serializer = MeltingLotSerializer(
            data={
                'products': [product.id],
                'parent_lots': [],
                'purity': purity.id,
                'description': 'Multi receipt melt',
                'hook_purity': 5.0,
                'receipt_allocations': [
                    {'metal_receipt_replica': first_receipt.replica.id, 'required_weight': 10.0},
                    {'metal_receipt_replica': second_receipt.replica.id, 'required_weight': 20.0},
                ],
                'is_active': True,
            },
            context={'request': request},
        )

        self.assertTrue(serializer.is_valid(), serializer.errors)
        melting_lot = serializer.save(user=self.user)
        first_receipt.refresh_from_db()
        second_receipt.refresh_from_db()
        first_receipt.replica.refresh_from_db()
        second_receipt.replica.refresh_from_db()

        self.assertEqual(melting_lot.required_weight, 30.0)
        self.assertGreater(melting_lot.require_alloy_weight, 0)
        self.assertEqual(melting_lot.receipt_allocations.count(), 2)
        self.assertEqual(first_receipt.out_weight, 10.0)
        self.assertEqual(second_receipt.out_weight, 20.0)
        self.assertEqual(first_receipt.replica.in_weight, 90.0)
        self.assertEqual(second_receipt.replica.in_weight, 60.0)
        self.assertEqual(len(serializer.data['receipt_allocation_details']), 2)

    def test_melting_lot_rounds_weight_values_to_three_decimals(self):
        product = Product.objects.create(product_name='Gold Coin Rounded', user=self.user)
        purity = Purity.objects.create(purity_value=80.0, user=self.user)
        metal_receipt = MetalReceipt.objects.create(
            accounts='Account R1',
            type='Receipt',
            description='Rounded value source',
            melting_purity=81.05,
            in_weight=100.0,
            user=self.user,
        )

        melting_lot = MeltingLot.objects.create(
            metal_receipt_replica=metal_receipt.replica,
            purity=purity,
            description='Rounded test',
            hook_purity=5.0,
            required_weight=10.0,
            user=self.user,
        )
        melting_lot.products.add(product)

        serializer = MeltingLotSerializer(instance=melting_lot)

        self.assertEqual(melting_lot.require_alloy_weight, 0.131)
        self.assertEqual(melting_lot.gross_weight, 10.131)
        self.assertEqual(serializer.data['require_alloy_weight'], 0.131)
        self.assertEqual(serializer.data['gross_weight'], 10.131)

    def test_melting_lot_negative_alloy_weight_is_not_possible(self):
        product = Product.objects.create(product_name='Gold Bar', user=self.user)
        purity = Purity.objects.create(purity_value=99.9, user=self.user)
        metal_receipt = MetalReceipt.objects.create(
            accounts='Account C',
            type='Receipt',
            description='High purity source',
            melting_purity=91.6,
            in_weight=100.0,
            user=self.user,
        )

        with self.assertRaisesMessage(Exception, 'Not possible'):
            melting_lot = MeltingLot.objects.create(
                metal_receipt_replica=metal_receipt.replica,
                purity=purity,
                description='Negative alloy test',
                hook_purity=2.0,
                required_weight=10.0,
                user=self.user,
            )
            melting_lot.products.add(product)

    def test_metal_receipt_creates_replica(self):
        metal_receipt = MetalReceipt.objects.create(
            accounts='Account Replica',
            type='Receipt',
            description='Replica source',
            melting_purity=95.0,
            in_weight=25.0,
            user=self.user,
        )

        replica = MetalReceiptReplica.objects.get(source_receipt=metal_receipt)
        self.assertEqual(replica.receipt_no, metal_receipt.receipt_no)
        self.assertEqual(replica.accounts, metal_receipt.accounts)
        self.assertEqual(replica.in_weight, metal_receipt.in_weight)
        self.assertEqual(replica.balance_weight, metal_receipt.balance_weight)
        self.assertEqual(metal_receipt.out_weight, 0)

    def test_field_definition_creation(self):
        field_definition = FieldDefinition.objects.create(
            field_name='Machine Size',
            field_type='text',
            user=self.user,
        )

        self.assertEqual(field_definition.field_name, 'Machine Size')
        self.assertEqual(field_definition.field_type, 'text')

    def test_field_definition_supports_boolean_type(self):
        field_definition = FieldDefinition.objects.create(
            field_name='QC Passed',
            field_type=FieldDefinition.FIELD_TYPE_BOOLEAN,
            user=self.user,
        )

        self.assertEqual(field_definition.field_type, FieldDefinition.FIELD_TYPE_BOOLEAN)

    def test_number_field_definition_can_be_configured_to_affect_balance(self):
        field_definition = FieldDefinition.objects.create(
            field_name='Recovery',
            field_type=FieldDefinition.FIELD_TYPE_NUMBER,
            affects_balance=True,
            balance_operation=FieldDefinition.BALANCE_OPERATION_ADD,
            user=self.user,
        )

        self.assertTrue(field_definition.affects_balance)
        self.assertEqual(field_definition.balance_operation, FieldDefinition.BALANCE_OPERATION_ADD)

    def test_department_record_creation(self):
        product = Product.objects.create(product_name='Gold Wire 2', user=self.user)
        process = Process.objects.create(product=product, process_name='Cutting', user=self.user)
        department = Department.objects.create(process=process, department_name='Bench Entry')
        purity = Purity.objects.create(purity_value=91.6, user=self.user)
        metal_receipt = MetalReceipt.objects.create(
            accounts='Account B',
            type='Receipt',
            description='Source batch',
            melting_purity=99.5,
            in_weight=50.0,
            user=self.user,
        )
        melting_lot = MeltingLot.objects.create(
            metal_receipt_replica=metal_receipt.replica,
            purity=purity,
            description='Department test',
            hook_purity=1.5,
            required_weight=10.0,
            user=self.user,
        )
        melting_lot.products.add(product)
        field_definition = FieldDefinition.objects.create(
            field_name='Out Weight',
            field_type='number',
            user=self.user,
        )
        department.fields.add(field_definition)

        record = DepartmentRecord.objects.create(
            department=department,
            melting_lot=melting_lot,
            out_weight=10.5,
            tounch=0.0,
            tounch_purity=91.6,
            field_values={'Out Weight': '97.4'},
            user=self.user,
            created_by=self.user,
            updated_by=self.user,
        )

        self.assertEqual(record.department, department)
        self.assertEqual(record.melting_lot, melting_lot)
        self.assertEqual(record.out_weight, 10.5)
        self.assertEqual(record.tounch_purity, 91.6)
        self.assertEqual(record.field_values['Out Weight'], '97.4')

    def test_next_department_uses_previous_department_balance_as_input(self):
        product = Product.objects.create(product_name='Gold Wire 3', user=self.user)
        process = Process.objects.create(product=product, process_name='Rolling', user=self.user)
        first_department = Department.objects.create(process=process, department_name='Dept 1')
        second_department = Department.objects.create(process=process, department_name='Dept 2')
        purity = Purity.objects.create(purity_value=91.6, user=self.user)
        metal_receipt = MetalReceipt.objects.create(
            accounts='Account D',
            type='Receipt',
            description='Department chain source',
            melting_purity=99.5,
            in_weight=80.0,
            user=self.user,
        )
        melting_lot = MeltingLot.objects.create(
            metal_receipt_replica=metal_receipt.replica,
            purity=purity,
            description='Chain test',
            hook_purity=1.0,
            required_weight=10.0,
            user=self.user,
        )
        melting_lot.products.add(product)

        first_record = DepartmentRecord.objects.create(
            department=first_department,
            melting_lot=melting_lot,
            out_weight=3.5,
            tounch=0.2,
            tounch_purity=91.6,
            field_values={},
            user=self.user,
            created_by=self.user,
            updated_by=self.user,
        )
        second_record = DepartmentRecord.objects.create(
            department=second_department,
            melting_lot=melting_lot,
            out_weight=1.0,
            tounch=0.1,
            tounch_purity=91.6,
            field_values={},
            user=self.user,
            created_by=self.user,
            updated_by=self.user,
        )

        self.assertEqual(first_record.input_weight, melting_lot.gross_weight)
        self.assertEqual(second_record.input_weight, first_record.out_weight)

    def test_next_department_can_receive_multiple_records_from_same_source_record(self):
        product = Product.objects.create(product_name='Gold Wire Multi Flow', user=self.user)
        process = Process.objects.create(product=product, process_name='Rolling', user=self.user)
        first_department = Department.objects.create(process=process, department_name='Dept 1')
        second_department = Department.objects.create(process=process, department_name='Dept 2')
        purity = Purity.objects.create(purity_value=91.6, user=self.user)
        metal_receipt = MetalReceipt.objects.create(
            accounts='Account D2',
            type='Receipt',
            description='Department multi source',
            melting_purity=99.5,
            in_weight=80.0,
            user=self.user,
        )
        melting_lot = MeltingLot.objects.create(
            metal_receipt_replica=metal_receipt.replica,
            purity=purity,
            description='Multi forward test',
            hook_purity=1.0,
            required_weight=10.0,
            user=self.user,
        )
        melting_lot.products.add(product)

        source_record = DepartmentRecord.objects.create(
            department=first_department,
            melting_lot=melting_lot,
            out_weight=3.5,
            tounch=0.2,
            tounch_purity=91.6,
            field_values={},
            user=self.user,
            created_by=self.user,
            updated_by=self.user,
        )
        first_child = DepartmentRecord.objects.create(
            department=second_department,
            melting_lot=melting_lot,
            source_record=source_record,
            input_weight_override=1.5,
            out_weight=1.0,
            tounch=0.1,
            tounch_purity=91.6,
            field_values={},
            user=self.user,
            created_by=self.user,
            updated_by=self.user,
        )
        second_child = DepartmentRecord.objects.create(
            department=second_department,
            melting_lot=melting_lot,
            source_record=source_record,
            input_weight_override=2.0,
            out_weight=0.5,
            tounch=0.1,
            tounch_purity=91.6,
            field_values={},
            user=self.user,
            created_by=self.user,
            updated_by=self.user,
        )

        self.assertEqual(first_child.input_weight, 1.5)
        self.assertEqual(second_child.input_weight, 2.0)

    def test_updating_source_record_out_weight_allows_another_next_department_record(self):
        product = Product.objects.create(product_name='Gold Wire Incremental Flow', user=self.user)
        process = Process.objects.create(product=product, process_name='Rolling', user=self.user)
        first_department = Department.objects.create(process=process, department_name='Dept 1')
        second_department = Department.objects.create(process=process, department_name='Dept 2')
        purity = Purity.objects.create(purity_value=91.6, user=self.user)
        metal_receipt = MetalReceipt.objects.create(
            accounts='Account Incremental',
            type='Receipt',
            description='Incremental source',
            melting_purity=99.5,
            in_weight=400.0,
            user=self.user,
        )
        melting_lot = MeltingLot.objects.create(
            metal_receipt_replica=metal_receipt.replica,
            purity=purity,
            description='Incremental forward test',
            hook_purity=1.0,
            required_weight=200.0,
            user=self.user,
        )
        melting_lot.products.add(product)

        source_record = DepartmentRecord.objects.create(
            department=first_department,
            melting_lot=melting_lot,
            out_weight=100.0,
            tounch=0.0,
            tounch_purity=91.6,
            field_values={},
            user=self.user,
            created_by=self.user,
            updated_by=self.user,
        )
        first_child = DepartmentRecord.objects.create(
            department=second_department,
            melting_lot=melting_lot,
            source_batch=source_record.transfer_batches.order_by('id').first(),
            out_weight=75.0,
            tounch=0.0,
            tounch_purity=91.6,
            field_values={},
            user=self.user,
            created_by=self.user,
            updated_by=self.user,
        )

        source_record.out_weight = 150.0
        source_record.updated_by = self.user
        source_record.save()
        batches = list(source_record.transfer_batches.values_list('forwarded_weight', flat=True))

        second_child = DepartmentRecord.objects.create(
            department=second_department,
            melting_lot=melting_lot,
            source_batch=source_record.transfer_batches.order_by('id').last(),
            out_weight=20.0,
            tounch=0.0,
            tounch_purity=91.6,
            field_values={},
            user=self.user,
            created_by=self.user,
            updated_by=self.user,
        )

        source_record.refresh_from_db()
        self.assertEqual(batches, [100.0, 50.0])
        self.assertEqual(first_child.input_weight, 100.0)
        self.assertEqual(second_child.input_weight, 50.0)
        self.assertEqual(source_record.out_weight, 150.0)
        self.assertEqual(
            DepartmentRecord.objects.filter(
                department=second_department,
                source_record=source_record,
            ).count(),
            2,
        )

    def test_updating_source_record_freezes_legacy_next_department_record_input_weight(self):
        product = Product.objects.create(product_name='Gold Wire Legacy Freeze', user=self.user)
        process = Process.objects.create(product=product, process_name='Rolling', user=self.user)
        first_department = Department.objects.create(process=process, department_name='Dept 1')
        second_department = Department.objects.create(process=process, department_name='Dept 2')
        purity = Purity.objects.create(purity_value=91.6, user=self.user)
        metal_receipt = MetalReceipt.objects.create(
            accounts='Account Legacy',
            type='Receipt',
            description='Legacy source',
            melting_purity=99.5,
            in_weight=400.0,
            user=self.user,
        )
        melting_lot = MeltingLot.objects.create(
            metal_receipt_replica=metal_receipt.replica,
            purity=purity,
            description='Legacy freeze test',
            hook_purity=1.0,
            required_weight=200.0,
            user=self.user,
        )
        melting_lot.products.add(product)

        source_record = DepartmentRecord.objects.create(
            department=first_department,
            melting_lot=melting_lot,
            out_weight=100.0,
            tounch=0.0,
            tounch_purity=91.6,
            field_values={},
            user=self.user,
            created_by=self.user,
            updated_by=self.user,
        )
        legacy_child = DepartmentRecord.objects.create(
            department=second_department,
            melting_lot=melting_lot,
            out_weight=75.0,
            tounch=0.0,
            tounch_purity=91.6,
            field_values={},
            user=self.user,
            created_by=self.user,
            updated_by=self.user,
        )

        source_record.out_weight = 150.0
        source_record.updated_by = self.user
        source_record.save()
        legacy_child.refresh_from_db()

        self.assertEqual(legacy_child.source_record_id, source_record.id)
        self.assertEqual(legacy_child.input_weight_override, 100.0)
        self.assertEqual(legacy_child.input_weight, 100.0)

    def test_first_department_of_next_process_uses_last_department_of_previous_process(self):
        product = Product.objects.create(product_name='Gold Wire 4', user=self.user)
        first_process = Process.objects.create(product=product, process_name='Melting', user=self.user)
        second_process = Process.objects.create(product=product, process_name='Rolling', user=self.user)
        first_process_department = Department.objects.create(process=first_process, department_name='Melting Dept')
        second_process_department = Department.objects.create(process=second_process, department_name='Rolling Dept')
        purity = Purity.objects.create(purity_value=91.6, user=self.user)
        metal_receipt = MetalReceipt.objects.create(
            accounts='Account E',
            type='Receipt',
            description='Cross process source',
            melting_purity=99.5,
            in_weight=60.0,
            user=self.user,
        )
        melting_lot = MeltingLot.objects.create(
            metal_receipt_replica=metal_receipt.replica,
            purity=purity,
            description='Cross process test',
            hook_purity=1.2,
            required_weight=10.0,
            user=self.user,
        )
        melting_lot.products.add(product)

        first_record = DepartmentRecord.objects.create(
            department=first_process_department,
            melting_lot=melting_lot,
            out_weight=4.25,
            tounch=0.25,
            tounch_purity=91.6,
            field_values={},
            user=self.user,
            created_by=self.user,
            updated_by=self.user,
        )
        second_record = DepartmentRecord.objects.create(
            department=second_process_department,
            melting_lot=melting_lot,
            out_weight=1.25,
            tounch=0.15,
            tounch_purity=91.6,
            field_values={},
            user=self.user,
            created_by=self.user,
            updated_by=self.user,
        )

        self.assertEqual(second_process_department.get_source_department(), first_process_department)
        self.assertEqual(second_record.input_weight, first_record.out_weight)

    def test_department_record_out_weight_cannot_exceed_input_weight(self):
        product = Product.objects.create(product_name='Gold Wire 5', user=self.user)
        process = Process.objects.create(product=product, process_name='Melting', user=self.user)
        department = Department.objects.create(process=process, department_name='Dept 1')
        purity = Purity.objects.create(purity_value=91.6, user=self.user)
        metal_receipt = MetalReceipt.objects.create(
            accounts='Account F',
            type='Receipt',
            description='OUT validation source',
            melting_purity=99.5,
            in_weight=50.0,
            user=self.user,
        )
        melting_lot = MeltingLot.objects.create(
            metal_receipt_replica=metal_receipt.replica,
            purity=purity,
            description='OUT validation test',
            hook_purity=1.0,
            required_weight=10.0,
            user=self.user,
        )
        melting_lot.products.add(product)

        with self.assertRaisesMessage(ValidationError, 'Not possible'):
            DepartmentRecord.objects.create(
                department=department,
                melting_lot=melting_lot,
                out_weight=melting_lot.gross_weight + 1,
                tounch=0.1,
                tounch_purity=91.6,
                field_values={},
                user=self.user,
                created_by=self.user,
                updated_by=self.user,
            )

    def test_department_record_balance_fields_are_calculated_from_input_and_receipt_purity(self):
        product = Product.objects.create(product_name='Gold Wire 6', user=self.user)
        process = Process.objects.create(product=product, process_name='Finishing', user=self.user)
        department = Department.objects.create(process=process, department_name='Dept Balance')
        purity = Purity.objects.create(purity_value=91.6, user=self.user)
        metal_receipt = MetalReceipt.objects.create(
            accounts='Account G',
            type='Receipt',
            description='Balance field source',
            melting_purity=99.5,
            in_weight=50.0,
            user=self.user,
        )
        melting_lot = MeltingLot.objects.create(
            metal_receipt_replica=metal_receipt.replica,
            purity=purity,
            description='Balance field test',
            hook_purity=1.0,
            required_weight=10.0,
            user=self.user,
        )
        melting_lot.products.add(product)

        record = DepartmentRecord.objects.create(
            department=department,
            melting_lot=melting_lot,
            out_weight=4.0,
            tounch=0.5,
            tounch_purity=91.6,
            field_values={},
            user=self.user,
            created_by=self.user,
            updated_by=self.user,
        )

        expected_balance = record.input_weight - record.out_weight - record.tounch
        expected_balance_gross = (expected_balance * metal_receipt.replica.melting_purity) / 100
        expected_balance_fine = (expected_balance_gross * purity.purity_value) / 100

        self.assertEqual(record.metal_receipt_purity, metal_receipt.replica.melting_purity)
        self.assertAlmostEqual(record.balance, expected_balance)
        self.assertAlmostEqual(record.balance_gross, expected_balance_gross)
        self.assertAlmostEqual(record.balance_fine, expected_balance_fine)

    def test_department_record_tounch_updates_balance_and_exposes_tounch_number(self):
        product = Product.objects.create(product_name='Gold Wire 7', user=self.user)
        process = Process.objects.create(product=product, process_name='Touch Test', user=self.user)
        department = Department.objects.create(process=process, department_name='Dept Touch')
        purity = Purity.objects.create(purity_value=91.6, user=self.user)
        metal_receipt = MetalReceipt.objects.create(
            accounts='Account H',
            type='Receipt',
            description='Touch source',
            melting_purity=99.5,
            in_weight=40.0,
            user=self.user,
        )
        melting_lot = MeltingLot.objects.create(
            metal_receipt_replica=metal_receipt.replica,
            purity=purity,
            description='Touch test',
            hook_purity=1.0,
            required_weight=10.0,
            user=self.user,
        )
        melting_lot.products.add(product)

        record = DepartmentRecord.objects.create(
            department=department,
            melting_lot=melting_lot,
            out_weight=4.0,
            tounch=1.5,
            tounch_purity=91.6,
            field_values={},
            user=self.user,
            created_by=self.user,
            updated_by=self.user,
        )

        expected_balance = record.input_weight - record.out_weight - record.tounch
        self.assertEqual(record.tounch_number, metal_receipt.id)
        self.assertAlmostEqual(record.balance, expected_balance)

    def test_department_record_balance_includes_configured_number_fields(self):
        product = Product.objects.create(product_name='Gold Wire 7A', user=self.user)
        process = Process.objects.create(product=product, process_name='Field Balance Test', user=self.user)
        department = Department.objects.create(process=process, department_name='Dept Field Balance')
        purity = Purity.objects.create(purity_value=91.6, user=self.user)
        metal_receipt = MetalReceipt.objects.create(
            accounts='Account H1',
            type='Receipt',
            description='Field balance source',
            melting_purity=99.5,
            in_weight=40.0,
            user=self.user,
        )
        melting_lot = MeltingLot.objects.create(
            metal_receipt_replica=metal_receipt.replica,
            purity=purity,
            description='Field balance test',
            hook_purity=1.0,
            required_weight=10.0,
            user=self.user,
        )
        melting_lot.products.add(product)
        add_field = FieldDefinition.objects.create(
            field_name='Recovery',
            field_type=FieldDefinition.FIELD_TYPE_NUMBER,
            affects_balance=True,
            balance_operation=FieldDefinition.BALANCE_OPERATION_ADD,
            user=self.user,
        )
        subtract_field = FieldDefinition.objects.create(
            field_name='Loss',
            field_type=FieldDefinition.FIELD_TYPE_NUMBER,
            affects_balance=True,
            balance_operation=FieldDefinition.BALANCE_OPERATION_SUBTRACT,
            user=self.user,
        )
        department.fields.add(add_field, subtract_field)

        record = DepartmentRecord.objects.create(
            department=department,
            melting_lot=melting_lot,
            out_weight=4.0,
            tounch=1.5,
            tounch_purity=91.6,
            field_values={'Recovery': '2.0', 'Loss': '0.5'},
            user=self.user,
            created_by=self.user,
            updated_by=self.user,
        )

        expected_balance = record.input_weight - record.out_weight - record.tounch + 2.0 - 0.5
        self.assertAlmostEqual(record.balance, expected_balance)

    def test_department_record_serializer_includes_detail_view_metadata(self):
        product = Product.objects.create(product_name='Gold Wire 7B', user=self.user)
        process = Process.objects.create(product=product, process_name='Detail View', user=self.user)
        department = Department.objects.create(process=process, department_name='Dept Detail')
        purity = Purity.objects.create(purity_value=91.6, user=self.user)
        parent_lot = ParentLot.objects.create(product=product, purity=purity, user=self.user)
        metal_receipt = MetalReceipt.objects.create(
            accounts='Account H2',
            type='Receipt',
            description='Detail source',
            melting_purity=99.5,
            in_weight=40.0,
            user=self.user,
        )
        melting_lot = MeltingLot.objects.create(
            metal_receipt_replica=metal_receipt.replica,
            purity=purity,
            description='Detail test',
            hook_purity=1.0,
            required_weight=10.0,
            user=self.user,
        )
        melting_lot.products.add(product)
        melting_lot.parent_lots.add(parent_lot)
        field_definition = FieldDefinition.objects.create(
            field_name='Karigar',
            field_type=FieldDefinition.FIELD_TYPE_TEXT,
            user=self.user,
        )
        department.fields.add(field_definition)

        record = DepartmentRecord.objects.create(
            department=department,
            melting_lot=melting_lot,
            out_weight=4.0,
            tounch=1.0,
            tounch_purity=91.6,
            field_values={'Karigar': 'Amit'},
            user=self.user,
            created_by=self.user,
            updated_by=self.user,
        )

        factory = APIRequestFactory()
        request = factory.get('/api/mgmt/department-records/')
        request.user = self.user
        serializer = DepartmentRecordSerializer(record, context={'request': request})

        self.assertEqual(serializer.data['product_name'], product.product_name)
        self.assertEqual(serializer.data['process_name'], process.process_name)
        self.assertEqual(serializer.data['department_name'], department.department_name)
        self.assertEqual(serializer.data['parent_lot_names'], [parent_lot.name])
        self.assertEqual(serializer.data['receipt_no'], metal_receipt.receipt_no)
        self.assertEqual(serializer.data['department_fields'][0]['field_name'], field_definition.field_name)
        self.assertEqual(serializer.data['transfer_batches'][0]['lot_no'], melting_lot.name)
        self.assertEqual(serializer.data['transfer_batches'][0]['input_weight'], record.input_weight)
        self.assertEqual(serializer.data['transfer_batches'][0]['tounch'], record.tounch)
        self.assertEqual(serializer.data['transfer_batches'][0]['field_values']['Karigar'], 'Amit')

    def test_department_record_tounch_cannot_make_balance_negative(self):
        product = Product.objects.create(product_name='Gold Wire 8', user=self.user)
        process = Process.objects.create(product=product, process_name='Touch Validation', user=self.user)
        department = Department.objects.create(process=process, department_name='Dept Touch Validation')
        purity = Purity.objects.create(purity_value=91.6, user=self.user)
        metal_receipt = MetalReceipt.objects.create(
            accounts='Account I',
            type='Receipt',
            description='Touch validation source',
            melting_purity=99.5,
            in_weight=40.0,
            user=self.user,
        )
        melting_lot = MeltingLot.objects.create(
            metal_receipt_replica=metal_receipt.replica,
            purity=purity,
            description='Touch validation test',
            hook_purity=1.0,
            required_weight=10.0,
            user=self.user,
        )
        melting_lot.products.add(product)

        with self.assertRaisesMessage(ValidationError, 'Not possible'):
            DepartmentRecord.objects.create(
                department=department,
                melting_lot=melting_lot,
                out_weight=melting_lot.gross_weight,
                tounch=1.0,
                tounch_purity=91.6,
                field_values={},
                user=self.user,
                created_by=self.user,
                updated_by=self.user,
            )

    def test_department_record_requires_tounch_purity(self):
        product = Product.objects.create(product_name='Gold Wire 9', user=self.user)
        process = Process.objects.create(product=product, process_name='Touch Purity Validation', user=self.user)
        department = Department.objects.create(process=process, department_name='Dept Touch Purity')
        purity = Purity.objects.create(purity_value=91.6, user=self.user)
        metal_receipt = MetalReceipt.objects.create(
            accounts='Account J',
            type='Receipt',
            description='Touch purity validation source',
            melting_purity=99.5,
            in_weight=40.0,
            user=self.user,
        )
        melting_lot = MeltingLot.objects.create(
            metal_receipt_replica=metal_receipt.replica,
            purity=purity,
            description='Touch purity validation test',
            hook_purity=1.0,
            required_weight=10.0,
            user=self.user,
        )
        melting_lot.products.add(product)

        factory = APIRequestFactory()
        request = factory.post('/api/mgmt/department-records/')
        request.user = self.user
        serializer = DepartmentRecordSerializer(
            data={
                'department': department.id,
                'melting_lot': melting_lot.id,
                'out_weight': 4.0,
                'tounch': 1.0,
                'field_values': {},
                'is_active': True,
            },
            context={'request': request},
        )

        self.assertFalse(serializer.is_valid())
        self.assertEqual(serializer.errors['tounch_purity'][0], 'Tounch purity is required.')

    def test_department_record_serializer_returns_all_receipt_rows_for_multi_receipt_lot(self):
        product = Product.objects.create(product_name='Gold Wire Multi Receipt', user=self.user)
        process = Process.objects.create(product=product, process_name='Melting', user=self.user)
        department = Department.objects.create(process=process, department_name='Bench Entry')
        purity = Purity.objects.create(purity_value=91.6, user=self.user)
        first_receipt = MetalReceipt.objects.create(
            accounts='Account MR1',
            type='Receipt',
            description='Multi 1',
            melting_purity=99.5,
            in_weight=100.0,
            user=self.user,
        )
        second_receipt = MetalReceipt.objects.create(
            accounts='Account MR2',
            type='Receipt',
            description='Multi 2',
            melting_purity=95.0,
            in_weight=80.0,
            user=self.user,
        )

        factory = APIRequestFactory()
        request = factory.post('/api/mgmt/melting-lots/')
        request.user = self.user
        melting_serializer = MeltingLotSerializer(
            data={
                'products': [product.id],
                'parent_lots': [],
                'purity': purity.id,
                'description': 'Multi receipt melt for record',
                'hook_purity': 5.0,
                'receipt_allocations': [
                    {'metal_receipt_replica': first_receipt.replica.id, 'required_weight': 10.0},
                    {'metal_receipt_replica': second_receipt.replica.id, 'required_weight': 15.0},
                ],
                'is_active': True,
            },
            context={'request': request},
        )
        self.assertTrue(melting_serializer.is_valid(), melting_serializer.errors)
        melting_lot = melting_serializer.save(user=self.user)

        record = DepartmentRecord.objects.create(
            department=department,
            melting_lot=melting_lot,
            out_weight=5.0,
            tounch=0.0,
            tounch_purity=91.6,
            field_values={},
            user=self.user,
            created_by=self.user,
            updated_by=self.user,
        )

        detail_request = factory.get('/api/mgmt/department-records/')
        detail_request.user = self.user
        serializer = DepartmentRecordSerializer(record, context={'request': detail_request})

        self.assertEqual(len(serializer.data['receipt_rows']), 2)
        self.assertEqual(serializer.data['receipt_rows'][0]['receipt_no'], first_receipt.receipt_no)
        self.assertEqual(serializer.data['receipt_rows'][1]['receipt_no'], second_receipt.receipt_no)
