from datetime import date

from rest_framework import serializers

from .models import Department, DepartmentRecord, DepartmentRecordTransferBatch, FieldDefinition, MeltingLot, MetalReceipt, MetalReceiptReplica, ParentLot, Process, Product, Purity


def round_weight(value):
    return round(float(value), 3)


class FieldDefinitionSerializer(serializers.ModelSerializer):
    def validate(self, attrs):
        field_type = attrs.get('field_type', getattr(self.instance, 'field_type', None))
        affects_balance = attrs.get('affects_balance', getattr(self.instance, 'affects_balance', False))
        balance_operation = attrs.get('balance_operation', getattr(self.instance, 'balance_operation', None))

        if field_type != FieldDefinition.FIELD_TYPE_NUMBER and affects_balance:
            raise serializers.ValidationError({'affects_balance': 'Only number fields can affect balance.'})
        if affects_balance and not balance_operation:
            raise serializers.ValidationError({'balance_operation': 'Select add or subtract.'})
        if not affects_balance:
            attrs['balance_operation'] = None

        return attrs

    class Meta:
        model = FieldDefinition
        fields = [
            'id',
            'field_name',
            'field_type',
            'affects_balance',
            'balance_operation',
            'user',
            'created_at',
            'updated_at',
            'is_active',
        ]
        read_only_fields = ['id', 'user', 'created_at', 'updated_at']


class DepartmentSerializer(serializers.ModelSerializer):
    previous_department_id = serializers.SerializerMethodField()
    field_ids = serializers.ListField(
        child=serializers.IntegerField(min_value=1),
        write_only=True,
        required=False,
    )
    fields = FieldDefinitionSerializer(many=True, read_only=True)

    class Meta:
        model = Department
        fields = ['id', 'process', 'department_name', 'previous_department_id', 'field_ids', 'fields']
        read_only_fields = ['id', 'previous_department_id', 'fields']

    def validate_process(self, value):
        if value.user_id != self.context['request'].user.id:
            raise serializers.ValidationError('Invalid process selection.')
        return value

    def validate_department_name(self, value):
        if not value.strip():
            raise serializers.ValidationError('Department name is required.')
        return value.strip()

    def validate_field_ids(self, value):
        request_user = self.context['request'].user
        existing_ids = set(
            FieldDefinition.objects.filter(
                user=request_user,
                is_active=True,
                id__in=value,
            ).values_list('id', flat=True)
        )
        missing_ids = [field_id for field_id in value if field_id not in existing_ids]
        if missing_ids:
            raise serializers.ValidationError(
                f'Invalid field ids: {missing_ids}'
            )
        return value

    def create(self, validated_data):
        field_ids = validated_data.pop('field_ids', [])
        department = super().create(validated_data)
        if field_ids:
            department.fields.set(
                FieldDefinition.objects.filter(
                    user=self.context['request'].user,
                    is_active=True,
                    id__in=field_ids,
                )
            )
        return department

    def get_previous_department_id(self, obj):
        source_department = obj.get_source_department()
        return source_department.id if source_department else None


class ProcessSerializer(serializers.ModelSerializer):
    departments = DepartmentSerializer(many=True, read_only=True)

    class Meta:
        model = Process
        fields = [
            'id',
            'product',
            'process_name',
            'user',
            'created_at',
            'sequence',
            'is_active',
            'departments',
        ]
        read_only_fields = ['id', 'user', 'created_at', 'sequence', 'departments']

    def validate_product(self, value):
        if value.user_id != self.context['request'].user.id:
            raise serializers.ValidationError('Invalid product selection.')
        return value


class ProductSerializer(serializers.ModelSerializer):
    processes = ProcessSerializer(many=True, read_only=True)

    class Meta:
        model = Product
        fields = ['id', 'product_name', 'user', 'created_at', 'is_active', 'processes']
        read_only_fields = ['id', 'user', 'created_at', 'processes']


class MetalReceiptSerializer(serializers.ModelSerializer):
    class Meta:
        model = MetalReceipt
        fields = [
            'id',
            'receipt_no',
            'accounts',
            'type',
            'date',
            'description',
            'melting_purity',
            'in_weight',
            'out_weight',
            'balance_weight',
            'user',
            'created_at',
            'is_active',
        ]
        read_only_fields = ['id', 'receipt_no', 'date', 'out_weight', 'balance_weight', 'user', 'created_at']


class MetalReceiptReplicaSerializer(serializers.ModelSerializer):
    source_receipt = serializers.PrimaryKeyRelatedField(read_only=True)
    original_in_weight = serializers.FloatField(source='source_receipt.in_weight', read_only=True)
    original_out_weight = serializers.FloatField(source='source_receipt.out_weight', read_only=True)
    original_balance_weight = serializers.FloatField(source='source_receipt.balance_weight', read_only=True)

    class Meta:
        model = MetalReceiptReplica
        fields = [
            'id',
            'source_receipt',
            'receipt_no',
            'accounts',
            'type',
            'date',
            'description',
            'melting_purity',
            'in_weight',
            'out_weight',
            'balance_weight',
            'original_in_weight',
            'original_out_weight',
            'original_balance_weight',
            'user',
            'created_at',
            'is_active',
        ]
        read_only_fields = fields


class PuritySerializer(serializers.ModelSerializer):
    class Meta:
        model = Purity
        fields = [
            'id',
            'purity_value',
            'date',
            'user',
            'created_at',
            'is_active',
        ]
        read_only_fields = ['id', 'date', 'user', 'created_at']


class ParentLotSerializer(serializers.ModelSerializer):
    class Meta:
        model = ParentLot
        fields = [
            'id',
            'name',
            'product',
            'purity',
            'date',
            'user',
            'created_at',
            'is_active',
        ]
        read_only_fields = ['id', 'name', 'date', 'user', 'created_at']

    def validate_product(self, value):
        if value.user_id != self.context['request'].user.id:
            raise serializers.ValidationError('Invalid product selection.')
        return value

    def validate_purity(self, value):
        if value.user_id != self.context['request'].user.id:
            raise serializers.ValidationError('Invalid purity selection.')
        return value


class MeltingLotReceiptAllocationDetailSerializer(serializers.Serializer):
    receipt_no = serializers.CharField()
    accounts = serializers.CharField()
    type = serializers.CharField()
    date = serializers.DateField()
    description = serializers.CharField()
    melting_purity = serializers.FloatField()
    in_weight = serializers.FloatField()
    balance_weight = serializers.FloatField()
    required_weight = serializers.FloatField()
    require_alloy_weight = serializers.FloatField()


class MeltingLotSerializer(serializers.ModelSerializer):
    receipt_allocations = serializers.ListField(
        child=serializers.DictField(),
        write_only=True,
        required=False,
    )
    receipt_allocation_details = serializers.SerializerMethodField()
    gross_weight = serializers.SerializerMethodField()

    class Meta:
        model = MeltingLot
        fields = [
            'id',
            'name',
            'date',
            'user',
            'products',
            'parent_lots',
            'metal_receipt',
            'metal_receipt_replica',
            'receipt_allocations',
            'receipt_allocation_details',
            'purity',
            'description',
            'hook_purity',
            'required_weight',
            'require_alloy_weight',
            'gross_weight',
            'created_at',
            'is_active',
        ]
        read_only_fields = ['id', 'name', 'date', 'user', 'require_alloy_weight', 'gross_weight', 'created_at', 'metal_receipt']
        extra_kwargs = {
            'metal_receipt_replica': {'required': False, 'allow_null': True},
            'required_weight': {'required': False},
        }

    def validate_purity(self, value):
        if value.user_id != self.context['request'].user.id:
            raise serializers.ValidationError('Invalid purity selection.')
        return value

    def validate_products(self, value):
        user_id = self.context['request'].user.id
        if any(product.user_id != user_id for product in value):
            raise serializers.ValidationError('Invalid product selection.')
        return value

    def validate_parent_lots(self, value):
        user_id = self.context['request'].user.id
        if any(parent_lot.user_id != user_id for parent_lot in value):
            raise serializers.ValidationError('Invalid parent lot selection.')
        return value

    def validate_metal_receipt(self, value):
        if value.user_id != self.context['request'].user.id:
            raise serializers.ValidationError('Invalid metal receipt selection.')
        return value

    def validate_metal_receipt_replica(self, value):
        if value.user_id != self.context['request'].user.id:
            raise serializers.ValidationError('Invalid metal receipt selection.')
        return value

    def validate_receipt_allocations(self, value):
        if not value:
            raise serializers.ValidationError('Select at least one metal receipt.')

        request_user = self.context['request'].user
        validated_allocations = []
        for allocation in value:
            replica_id = allocation.get('metal_receipt_replica')
            required_weight = allocation.get('required_weight')

            if not replica_id:
                raise serializers.ValidationError('Metal receipt is required for each selected row.')

            try:
                receipt_replica = MetalReceiptReplica.objects.get(
                    pk=replica_id,
                    user=request_user,
                    is_active=True,
                    source_receipt__is_active=True,
                )
            except MetalReceiptReplica.DoesNotExist:
                raise serializers.ValidationError('Invalid metal receipt selection.')

            try:
                parsed_required_weight = round_weight(required_weight)
            except (TypeError, ValueError):
                raise serializers.ValidationError(
                    f'Required weight must be a valid number for {receipt_replica.receipt_no}.'
                )

            validated_allocations.append(
                {
                    'metal_receipt_replica': receipt_replica,
                    'required_weight': parsed_required_weight,
                }
            )

        return validated_allocations

    def validate(self, attrs):
        attrs = super().validate(attrs)
        receipt_allocations = attrs.get('receipt_allocations')
        if receipt_allocations:
            attrs['required_weight'] = round_weight(sum(
                allocation['required_weight'] for allocation in receipt_allocations
            ))
        elif not attrs.get('metal_receipt_replica'):
            raise serializers.ValidationError({'receipt_allocations': 'Select at least one metal receipt.'})
        return attrs

    def get_gross_weight(self, obj):
        return round_weight(obj.gross_weight)

    def to_representation(self, instance):
        data = super().to_representation(instance)
        for field in ('hook_purity', 'required_weight', 'require_alloy_weight', 'gross_weight'):
            value = data.get(field)
            if value is not None:
                data[field] = round_weight(value)
        return data

    def get_receipt_allocation_details(self, obj):
        allocations = obj.receipt_allocations.select_related('metal_receipt').all()
        if allocations:
            return [
                {
                    'receipt_no': allocation.metal_receipt.receipt_no,
                    'accounts': allocation.metal_receipt.accounts,
                    'type': allocation.metal_receipt.type,
                    'date': allocation.metal_receipt.date,
                    'description': allocation.metal_receipt.description,
                    'melting_purity': round_weight(allocation.metal_receipt.melting_purity),
                    'in_weight': round_weight(allocation.metal_receipt.in_weight),
                    'balance_weight': round_weight(allocation.metal_receipt.balance_weight),
                    'required_weight': round_weight(allocation.required_weight),
                    'require_alloy_weight': round_weight(allocation.require_alloy_weight),
                }
                for allocation in allocations
            ]

        receipt = obj.metal_receipt
        if not receipt and obj.metal_receipt_replica_id:
            receipt = obj.metal_receipt_replica.source_receipt
        if not receipt:
            return []

        return [
            {
                'receipt_no': receipt.receipt_no,
                'accounts': receipt.accounts,
                'type': receipt.type,
                'date': receipt.date,
                'description': receipt.description,
                'melting_purity': round_weight(receipt.melting_purity),
                'in_weight': round_weight(receipt.in_weight),
                'balance_weight': round_weight(receipt.balance_weight),
                'required_weight': round_weight(obj.required_weight),
                'require_alloy_weight': round_weight(obj.require_alloy_weight),
            }
        ]

    def create(self, validated_data):
        receipt_allocations = validated_data.pop('receipt_allocations', None)
        products = validated_data.pop('products', [])
        parent_lots = validated_data.pop('parent_lots', [])
        melting_lot = MeltingLot(**validated_data)
        if receipt_allocations is not None:
            melting_lot._pending_receipt_allocations = receipt_allocations
        melting_lot.save()
        melting_lot.products.set(products)
        melting_lot.parent_lots.set(parent_lots)
        return melting_lot


class DepartmentRecordSerializer(serializers.ModelSerializer):
    source_batch = serializers.PrimaryKeyRelatedField(
        queryset=DepartmentRecordTransferBatch.objects.none(),
        required=False,
        allow_null=True,
    )
    product_name = serializers.CharField(source='department.process.product.product_name', read_only=True)
    process_name = serializers.CharField(source='department.process.process_name', read_only=True)
    department_name = serializers.CharField(source='department.department_name', read_only=True)
    lot_no = serializers.CharField(source='melting_lot.name', read_only=True)
    lot_purity = serializers.FloatField(source='melting_lot.purity.purity_value', read_only=True)
    parent_lot_names = serializers.SerializerMethodField()
    in_weight = serializers.SerializerMethodField()
    metal_receipt_purity = serializers.FloatField(read_only=True)
    tounch_number = serializers.IntegerField(read_only=True)
    receipt_no = serializers.SerializerMethodField()
    receipt_accounts = serializers.SerializerMethodField()
    receipt_type = serializers.SerializerMethodField()
    receipt_date = serializers.SerializerMethodField()
    receipt_description = serializers.SerializerMethodField()
    receipt_in_weight = serializers.SerializerMethodField()
    receipt_balance_weight = serializers.SerializerMethodField()
    receipt_rows = serializers.SerializerMethodField()
    transfer_batches = serializers.SerializerMethodField()
    balance = serializers.FloatField(read_only=True)
    balance_gross = serializers.FloatField(read_only=True)
    balance_fine = serializers.FloatField(read_only=True)
    date = serializers.DateTimeField(source='melting_lot.created_at', read_only=True)
    created_by_username = serializers.CharField(source='created_by.username', read_only=True)
    department_fields = FieldDefinitionSerializer(source='department.fields', many=True, read_only=True)

    class Meta:
        model = DepartmentRecord
        fields = [
            'id',
            'department',
            'melting_lot',
            'source_record',
            'source_batch',
            'input_weight_override',
            'product_name',
            'process_name',
            'department_name',
            'lot_no',
            'lot_purity',
            'parent_lot_names',
            'in_weight',
            'metal_receipt_purity',
            'out_weight',
            'tounch_number',
            'receipt_no',
            'receipt_accounts',
            'receipt_type',
            'receipt_date',
            'receipt_description',
            'receipt_in_weight',
            'receipt_balance_weight',
            'receipt_rows',
            'transfer_batches',
            'tounch',
            'tounch_purity',
            'balance',
            'balance_gross',
            'balance_fine',
            'date',
            'field_values',
            'department_fields',
            'user',
            'created_by',
            'created_by_username',
            'updated_by',
            'created_at',
            'updated_at',
            'is_active',
        ]
        read_only_fields = [
            'id',
            'product_name',
            'process_name',
            'department_name',
            'lot_no',
            'lot_purity',
            'parent_lot_names',
            'in_weight',
            'metal_receipt_purity',
            'tounch_number',
            'receipt_no',
            'receipt_accounts',
            'receipt_type',
            'receipt_date',
            'receipt_description',
            'receipt_in_weight',
            'receipt_balance_weight',
            'receipt_rows',
            'transfer_batches',
            'department_fields',
            'date',
            'user',
            'created_by',
            'created_by_username',
            'updated_by',
            'created_at',
            'updated_at',
        ]

    def get_in_weight(self, obj):
        return obj.input_weight

    def get_parent_lot_names(self, obj):
        return list(obj.melting_lot.parent_lots.values_list('name', flat=True))

    def _get_receipt(self, obj):
        if obj.melting_lot.metal_receipt_id:
            return obj.melting_lot.metal_receipt
        if obj.melting_lot.metal_receipt_replica_id:
            return obj.melting_lot.metal_receipt_replica.source_receipt
        return None

    def get_receipt_no(self, obj):
        receipt = self._get_receipt(obj)
        return receipt.receipt_no if receipt else None

    def get_receipt_accounts(self, obj):
        receipt = self._get_receipt(obj)
        return receipt.accounts if receipt else None

    def get_receipt_type(self, obj):
        receipt = self._get_receipt(obj)
        return receipt.type if receipt else None

    def get_receipt_date(self, obj):
        receipt = self._get_receipt(obj)
        return receipt.date if receipt else None

    def get_receipt_description(self, obj):
        receipt = self._get_receipt(obj)
        return receipt.description if receipt else None

    def get_receipt_in_weight(self, obj):
        receipt = self._get_receipt(obj)
        return receipt.in_weight if receipt else None

    def get_receipt_balance_weight(self, obj):
        receipt = self._get_receipt(obj)
        return receipt.balance_weight if receipt else None

    def get_receipt_rows(self, obj):
        allocations = obj.melting_lot.receipt_allocations.select_related('metal_receipt').all()
        if allocations:
            return [
                {
                    'receipt_no': allocation.metal_receipt.receipt_no,
                    'accounts': allocation.metal_receipt.accounts,
                    'type': allocation.metal_receipt.type,
                    'date': allocation.metal_receipt.date,
                    'description': allocation.metal_receipt.description,
                    'melting_purity': allocation.metal_receipt.melting_purity,
                    'in_weight': allocation.metal_receipt.in_weight,
                    'balance_weight': allocation.metal_receipt.balance_weight,
                    'required_weight': allocation.required_weight,
                    'require_alloy_weight': allocation.require_alloy_weight,
                }
                for allocation in allocations
            ]

        receipt = self._get_receipt(obj)
        if not receipt:
            return []

        return [
            {
                'receipt_no': receipt.receipt_no,
                'accounts': receipt.accounts,
                'type': receipt.type,
                'date': receipt.date,
                'description': receipt.description,
                'melting_purity': receipt.melting_purity,
                'in_weight': receipt.in_weight,
                'balance_weight': receipt.balance_weight,
                'required_weight': obj.melting_lot.required_weight,
                'require_alloy_weight': obj.melting_lot.require_alloy_weight,
            }
        ]

    def get_transfer_batches(self, obj):
        return [
            {
                'id': batch.id,
                'lot_no': batch.source_record.melting_lot.name,
                'lot_purity': batch.source_record.melting_lot.purity.purity_value,
                'input_weight': batch.input_weight_snapshot,
                'forwarded_weight': batch.forwarded_weight,
                'total_out_weight': batch.total_out_weight_snapshot,
                'tounch_number': batch.source_record.tounch_number,
                'tounch': batch.tounch_snapshot,
                'tounch_purity': batch.tounch_purity_snapshot,
                'balance': batch.balance_snapshot,
                'balance_gross': batch.balance_gross_snapshot,
                'balance_fine': batch.balance_fine_snapshot,
                'field_values': batch.field_values_snapshot,
                'saved_at': batch.created_at,
            }
            for batch in obj.transfer_batches.all()
        ]

    def validate(self, attrs):
        request_user = self.context['request'].user
        department = attrs.get('department')
        melting_lot = attrs.get('melting_lot')
        source_record = attrs.get('source_record', getattr(self.instance, 'source_record', None))
        source_batch = attrs.get('source_batch', getattr(self.instance, 'source_batch', None))
        input_weight_override = attrs.get('input_weight_override', getattr(self.instance, 'input_weight_override', None))
        field_values = attrs.get('field_values', {})

        if department and department.process.user_id != request_user.id:
            raise serializers.ValidationError('Invalid department.')
        if not melting_lot:
            raise serializers.ValidationError('Melting lot is required.')
        if melting_lot and melting_lot.user_id != request_user.id:
            raise serializers.ValidationError('Invalid melting lot.')
        if source_batch and source_batch.source_record.user_id != request_user.id:
            raise serializers.ValidationError({'source_batch': 'Invalid source batch.'})
        if source_record and source_record.user_id != request_user.id:
            raise serializers.ValidationError({'source_record': 'Invalid source record.'})
        out_weight = attrs.get('out_weight')
        if out_weight is None:
            raise serializers.ValidationError({'out_weight': 'OUT weight is required.'})
        if out_weight < 0:
            raise serializers.ValidationError({'out_weight': 'OUT weight cannot be negative.'})
        tounch = attrs.get('tounch')
        if tounch is None:
            raise serializers.ValidationError({'tounch': 'Tounch is required.'})
        if tounch < 0:
            raise serializers.ValidationError({'tounch': 'Tounch cannot be negative.'})
        tounch_purity = attrs.get('tounch_purity')
        if tounch_purity is None:
            raise serializers.ValidationError({'tounch_purity': 'Tounch purity is required.'})
        if tounch_purity < 0:
            raise serializers.ValidationError({'tounch_purity': 'Tounch purity cannot be negative.'})
        if department:
            source_department = department.get_source_department()
            if source_department:
                if source_batch:
                    if source_batch.source_record.department_id != source_department.id:
                        raise serializers.ValidationError({'source_batch': 'Source batch must belong to the previous department.'})
                    if source_batch.source_record.melting_lot_id != melting_lot.id:
                        raise serializers.ValidationError({'source_batch': 'Source batch must belong to the same melting lot.'})
                    input_weight = source_batch.forwarded_weight
                elif source_record:
                    if source_record.department_id != source_department.id:
                        raise serializers.ValidationError({'source_record': 'Source record must belong to the previous department.'})
                    if source_record.melting_lot_id != melting_lot.id:
                        raise serializers.ValidationError({'source_record': 'Source record must belong to the same melting lot.'})
                    if input_weight_override is None or input_weight_override <= 0:
                        raise serializers.ValidationError({'input_weight_override': 'Input weight is required.'})
                elif not DepartmentRecord.objects.filter(
                    department=source_department,
                    melting_lot=melting_lot,
                    user=request_user,
                    is_active=True,
                ).exists():
                    raise serializers.ValidationError(
                        'Previous stage record is required for this melting lot.'
                    )
        input_weight = None
        if department and melting_lot:
            if source_department:
                if source_batch:
                    input_weight = source_batch.forwarded_weight
                elif source_record and input_weight_override is not None:
                    input_weight = input_weight_override
                else:
                    previous_record = DepartmentRecord.objects.filter(
                        department=source_department,
                        melting_lot=melting_lot,
                        user=request_user,
                        is_active=True,
                    ).order_by('-created_at').first()
                    if previous_record:
                        input_weight = previous_record.out_weight
            else:
                input_weight = melting_lot.gross_weight
        if input_weight is not None and out_weight + tounch > input_weight:
            raise serializers.ValidationError({'tounch': 'Not possible'})

        if department:
            allowed_fields = {field.field_name: field.field_type for field in department.fields.all()}
            extra_keys = [key for key in field_values.keys() if key not in allowed_fields]
            if extra_keys:
                raise serializers.ValidationError(
                    f'Invalid field_values keys for selected department: {extra_keys}'
                )

            for key, raw_value in field_values.items():
                if raw_value in (None, ''):
                    continue
                field_type = allowed_fields[key]
                if field_type == FieldDefinition.FIELD_TYPE_NUMBER:
                    try:
                        float(raw_value)
                    except (TypeError, ValueError):
                        raise serializers.ValidationError({key: 'Enter a valid number.'})
                if field_type == FieldDefinition.FIELD_TYPE_DATE:
                    if isinstance(raw_value, date):
                        continue
                    try:
                        date.fromisoformat(str(raw_value))
                    except ValueError:
                        raise serializers.ValidationError({key: 'Enter a valid date in YYYY-MM-DD format.'})
                if field_type == FieldDefinition.FIELD_TYPE_BOOLEAN:
                    if isinstance(raw_value, bool):
                        continue
                    normalized_value = str(raw_value).strip().lower()
                    if normalized_value not in {'true', 'false'}:
                        raise serializers.ValidationError({key: 'Enter a valid boolean value.'})

        return attrs

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        request = self.context.get('request')
        if request and request.user and request.user.is_authenticated:
            self.fields['source_batch'].queryset = self.fields['source_batch'].queryset.model.objects.filter(
                source_record__user=request.user,
            )
