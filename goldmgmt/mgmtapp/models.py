from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.db.models import Q, Sum


def round_weight(value):
    return round(value, 3)


class Product(models.Model):
    product_name = models.CharField(max_length=255)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='products')
    created_at = models.DateTimeField(auto_now_add=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ['-created_at']
        unique_together = ('user', 'product_name')

    def __str__(self):
        return self.product_name


class Process(models.Model):
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='processes')
    process_name = models.CharField(max_length=255)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='processes')
    created_at = models.DateTimeField(auto_now_add=True)
    sequence = models.PositiveIntegerField(editable=False)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ['sequence', 'created_at']
        unique_together = ('product', 'sequence')

    def save(self, *args, **kwargs):
        if not self.pk:
            last_sequence = (
                Process.objects.filter(product=self.product)
                .aggregate(models.Max('sequence'))
                .get('sequence__max')
                or 0
            )
            self.sequence = last_sequence + 1

        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.product.product_name} - {self.process_name}"

    def get_previous_process(self):
        return self.product.processes.filter(sequence__lt=self.sequence).order_by('-sequence').first()


class FieldDefinition(models.Model):
    FIELD_TYPE_TEXT = 'text'
    FIELD_TYPE_NUMBER = 'number'
    FIELD_TYPE_DATE = 'date'
    FIELD_TYPE_BOOLEAN = 'boolean'
    BALANCE_OPERATION_ADD = 'add'
    BALANCE_OPERATION_SUBTRACT = 'subtract'
    FIELD_TYPE_CHOICES = [
        (FIELD_TYPE_TEXT, 'Text'),
        (FIELD_TYPE_NUMBER, 'Number'),
        (FIELD_TYPE_DATE, 'Date'),
        (FIELD_TYPE_BOOLEAN, 'Boolean'),
    ]
    BALANCE_OPERATION_CHOICES = [
        (BALANCE_OPERATION_ADD, 'Add'),
        (BALANCE_OPERATION_SUBTRACT, 'Subtract'),
    ]

    field_name = models.CharField(max_length=255)
    field_type = models.CharField(max_length=20, choices=FIELD_TYPE_CHOICES)
    affects_balance = models.BooleanField(default=False)
    balance_operation = models.CharField(
        max_length=10,
        choices=BALANCE_OPERATION_CHOICES,
        blank=True,
        null=True,
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='field_definitions',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ['field_name', '-created_at']
        unique_together = ('user', 'field_name')

    def clean(self):
        if self.field_type != self.FIELD_TYPE_NUMBER and self.affects_balance:
            raise ValidationError('Only number fields can affect balance.')
        if self.affects_balance and not self.balance_operation:
            raise ValidationError('Balance operation is required when field affects balance.')
        if not self.affects_balance:
            self.balance_operation = None

    def __str__(self):
        return f"{self.field_name} ({self.field_type})"


class Department(models.Model):
    process = models.ForeignKey(Process, on_delete=models.CASCADE, related_name='departments')
    department_name = models.CharField(max_length=255, blank=True, default='')
    fields = models.ManyToManyField(FieldDefinition, related_name='departments', blank=True)

    class Meta:
        ordering = ['id']

    def __str__(self):
        label = self.department_name or f"Department {self.pk or 'new'}"
        return f"{self.process.process_name} - {label}"

    def get_previous_department(self):
        return self.process.departments.filter(id__lt=self.id).order_by('-id').first()

    def get_source_department(self):
        previous_department = self.get_previous_department()
        if previous_department:
            return previous_department

        previous_process = self.process.get_previous_process()
        if not previous_process:
            return None

        return previous_process.departments.order_by('-id').first()


class MetalReceipt(models.Model):
    receipt_no = models.CharField(max_length=32, unique=True, editable=False, blank=True, null=True)
    accounts = models.CharField(max_length=255)
    type = models.CharField(max_length=100)
    date = models.DateField(auto_now_add=True)
    description = models.TextField(blank=True)
    melting_purity = models.FloatField()
    in_weight = models.FloatField()
    out_weight = models.FloatField(default=0)
    balance_weight = models.FloatField(editable=False, default=0)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='metal_receipts',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ['-date', '-created_at']

    def clean(self):
        if self.out_weight < 0:
            raise ValidationError('Out weight cannot be negative.')

    def refresh_usage_totals(self, save=True):
        allocation_total = MeltingLotReceiptAllocation.objects.filter(
            metal_receipt=self,
            melting_lot__is_active=True,
        ).aggregate(total=Sum('required_weight')).get('total') or 0
        legacy_total = MeltingLot.objects.filter(
            Q(metal_receipt=self) | Q(metal_receipt_replica__source_receipt=self),
            is_active=True,
            receipt_allocations__isnull=True,
        ).aggregate(total=Sum('required_weight')).get('total') or 0
        total_required_weight = allocation_total + legacy_total
        self.out_weight = total_required_weight
        self.balance_weight = self.in_weight - self.out_weight
        if save:
            super().save(update_fields=['out_weight', 'balance_weight'])

    def save(self, *args, **kwargs):
        if self.pk:
            self.refresh_usage_totals(save=False)
        else:
            self.out_weight = 0
            self.balance_weight = self.in_weight
        self.full_clean()
        is_new = self.pk is None
        super().save(*args, **kwargs)
        if is_new and not self.receipt_no:
            self.receipt_no = f"MR-{self.pk:06d}"
            super().save(update_fields=['receipt_no'])
        if is_new or not hasattr(self, 'replica'):
            MetalReceiptReplica.objects.update_or_create(
                source_receipt=self,
                defaults={
                    'receipt_no': self.receipt_no,
                    'accounts': self.accounts,
                    'type': self.type,
                    'date': self.date,
                    'description': self.description,
                    'melting_purity': self.melting_purity,
                    'in_weight': self.in_weight,
                    'out_weight': self.out_weight,
                    'balance_weight': self.balance_weight,
                    'user': self.user,
                    'is_active': self.is_active,
                },
            )

    def __str__(self):
        return f"{self.accounts} - {self.type}"


class MetalReceiptReplica(models.Model):
    source_receipt = models.OneToOneField(
        MetalReceipt,
        on_delete=models.CASCADE,
        related_name='replica',
    )
    receipt_no = models.CharField(max_length=32, unique=True, blank=True, null=True)
    accounts = models.CharField(max_length=255)
    type = models.CharField(max_length=100)
    date = models.DateField()
    description = models.TextField(blank=True)
    melting_purity = models.FloatField()
    in_weight = models.FloatField()
    out_weight = models.FloatField(default=0)
    balance_weight = models.FloatField(editable=False, default=0)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='metal_receipt_replicas',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ['-date', '-created_at']

    def clean(self):
        if self.out_weight < 0:
            raise ValidationError('Out weight cannot be negative.')

    def save(self, *args, **kwargs):
        self.balance_weight = self.in_weight - self.out_weight
        self.full_clean()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.accounts} - {self.type} (Replica)"


class Purity(models.Model):
    purity_value = models.FloatField()
    date = models.DateField(auto_now_add=True)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='purities',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ['-date', '-created_at']

    def __str__(self):
        return str(self.purity_value)


class ParentLot(models.Model):
    name = models.CharField(max_length=32, unique=True, editable=False, blank=True)
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='parent_lots')
    purity = models.ForeignKey(Purity, on_delete=models.CASCADE, related_name='parent_lots')
    date = models.DateField(auto_now_add=True)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='parent_lots',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ['-date', '-created_at']

    def save(self, *args, **kwargs):
        is_new = self.pk is None
        super().save(*args, **kwargs)

        if is_new and not self.name:
            self.name = f"PL-{self.pk:06d}"
            super().save(update_fields=['name'])

    def __str__(self):
        return self.name


class MeltingLot(models.Model):
    name = models.CharField(max_length=32, unique=True, editable=False, blank=True)
    date = models.DateField(auto_now_add=True)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='melting_lots',
    )
    products = models.ManyToManyField(Product, related_name='melting_lots')
    parent_lots = models.ManyToManyField(ParentLot, blank=True, related_name='melting_lots')
    metal_receipt = models.ForeignKey(
        MetalReceipt,
        on_delete=models.PROTECT,
        related_name='melting_lots',
        null=True,
        blank=True,
    )
    metal_receipt_replica = models.ForeignKey(
        MetalReceiptReplica,
        on_delete=models.PROTECT,
        related_name='melting_lots',
        null=True,
        blank=True,
    )
    purity = models.ForeignKey(Purity, on_delete=models.CASCADE, related_name='melting_lots')
    description = models.TextField(blank=True)
    hook_purity = models.FloatField(default=0)
    required_weight = models.FloatField()
    require_alloy_weight = models.FloatField(editable=False, default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ['-date', '-created_at']

    def _calculate_alloy_for_receipt(self, working_receipt, required_weight):
        pure_gold_weight = (working_receipt.in_weight * working_receipt.melting_purity) / 100
        total_weight = (pure_gold_weight / self.purity.purity_value) * 100
        total_alloy_weight = total_weight - working_receipt.in_weight
        return round_weight((required_weight * total_alloy_weight) / working_receipt.in_weight)

    def _get_pending_receipt_allocations(self):
        return getattr(self, '_pending_receipt_allocations', None)

    def clean(self):
        if self.purity.purity_value <= 0:
            raise ValidationError('Melting lot purity must be greater than 0.')
        if self.hook_purity < 0:
            raise ValidationError('Hook purity cannot be negative.')

        pending_receipt_allocations = self._get_pending_receipt_allocations()
        if pending_receipt_allocations is not None:
            if not pending_receipt_allocations:
                raise ValidationError('At least one metal receipt is required.')

            total_required_weight = 0
            total_required_alloy_weight = 0
            for allocation in pending_receipt_allocations:
                working_receipt = allocation['metal_receipt_replica']
                required_weight = allocation['required_weight']
                if working_receipt.in_weight <= 0:
                    raise ValidationError('Metal receipt in weight must be greater than 0.')
                if required_weight <= 0:
                    raise ValidationError('Required weight must be greater than 0.')
                if required_weight > working_receipt.in_weight:
                    raise ValidationError('Required weight cannot exceed selected metal receipt in weight.')

                total_required_weight += required_weight
                total_required_alloy_weight += self._calculate_alloy_for_receipt(working_receipt, required_weight)

            if total_required_alloy_weight <= 0:
                raise ValidationError('Not possible')

            self.required_weight = round_weight(total_required_weight)
            self.require_alloy_weight = round_weight(total_required_alloy_weight)
            return

        working_receipt = self.metal_receipt_replica or getattr(self.metal_receipt, 'replica', None)
        if not self.metal_receipt and not working_receipt:
            raise ValidationError('Metal receipt is required.')
        if not working_receipt:
            raise ValidationError('Metal receipt replica is required.')
        if working_receipt.in_weight <= 0:
            raise ValidationError('Metal receipt in weight must be greater than 0.')
        if self.required_weight <= 0:
            raise ValidationError('Required weight must be greater than 0.')
        if self.required_weight > working_receipt.in_weight:
            raise ValidationError('Required weight cannot exceed selected metal receipt in weight.')

    def save(self, *args, **kwargs):
        pending_receipt_allocations = self._get_pending_receipt_allocations()
        if pending_receipt_allocations is not None:
            first_receipt = pending_receipt_allocations[0]['metal_receipt_replica']
            if not self.metal_receipt_id:
                self.metal_receipt = first_receipt.source_receipt
            if not self.metal_receipt_replica_id:
                self.metal_receipt_replica = first_receipt
            self.full_clean()

            is_new = self.pk is None
            super().save(*args, **kwargs)

            if is_new:
                affected_sources = set()
                for allocation in pending_receipt_allocations:
                    working_receipt = allocation['metal_receipt_replica']
                    required_weight = allocation['required_weight']
                    required_alloy_weight = self._calculate_alloy_for_receipt(working_receipt, required_weight)
                    MeltingLotReceiptAllocation.objects.create(
                        melting_lot=self,
                        metal_receipt=working_receipt.source_receipt,
                        metal_receipt_replica=working_receipt,
                        required_weight=round_weight(required_weight),
                        require_alloy_weight=required_alloy_weight,
                    )
                    working_receipt.in_weight = working_receipt.in_weight - required_weight
                    working_receipt.save(update_fields=['in_weight', 'balance_weight'])
                    affected_sources.add(working_receipt.source_receipt_id)

                for source_receipt_id in affected_sources:
                    MetalReceipt.objects.get(pk=source_receipt_id).refresh_usage_totals()

            if is_new and not self.name:
                self.name = f"ML-{self.pk:06d}"
                super().save(update_fields=['name'])
            return

        working_receipt = self.metal_receipt_replica or getattr(self.metal_receipt, 'replica', None)
        if self.metal_receipt_replica and not self.metal_receipt_id:
            self.metal_receipt = self.metal_receipt_replica.source_receipt

        calculated_alloy_weight = self._calculate_alloy_for_receipt(working_receipt, self.required_weight)
        if calculated_alloy_weight < 0:
            raise ValidationError('Not possible')
        self.required_weight = round_weight(self.required_weight)
        self.require_alloy_weight = round_weight(calculated_alloy_weight)
        self.full_clean()

        is_new = self.pk is None
        super().save(*args, **kwargs)

        if is_new:
            working_receipt.in_weight = working_receipt.in_weight - self.required_weight
            working_receipt.save(update_fields=['in_weight', 'balance_weight'])
            self.metal_receipt.refresh_usage_totals()

        if is_new and not self.name:
            self.name = f"ML-{self.pk:06d}"
            super().save(update_fields=['name'])

    def __str__(self):
        return self.name

    @property
    def gross_weight(self):
        return round_weight(self.required_weight + self.require_alloy_weight)


class MeltingLotReceiptAllocation(models.Model):
    melting_lot = models.ForeignKey(
        MeltingLot,
        on_delete=models.CASCADE,
        related_name='receipt_allocations',
    )
    metal_receipt = models.ForeignKey(
        MetalReceipt,
        on_delete=models.PROTECT,
        related_name='melting_lot_allocations',
    )
    metal_receipt_replica = models.ForeignKey(
        MetalReceiptReplica,
        on_delete=models.PROTECT,
        related_name='melting_lot_allocations',
    )
    required_weight = models.FloatField()
    require_alloy_weight = models.FloatField()

    class Meta:
        ordering = ['id']


class DepartmentRecord(models.Model):
    department = models.ForeignKey(
        Department,
        on_delete=models.CASCADE,
        related_name='records',
    )
    melting_lot = models.ForeignKey(
        MeltingLot,
        on_delete=models.PROTECT,
        related_name='department_records',
        null=True,
        blank=True,
    )
    source_record = models.ForeignKey(
        'self',
        on_delete=models.PROTECT,
        related_name='next_department_records',
        null=True,
        blank=True,
    )
    source_batch = models.ForeignKey(
        'DepartmentRecordTransferBatch',
        on_delete=models.PROTECT,
        related_name='child_records',
        null=True,
        blank=True,
    )
    input_weight_override = models.FloatField(null=True, blank=True)
    out_weight = models.FloatField(default=0)
    tounch = models.FloatField(default=0)
    tounch_purity = models.FloatField(default=0)
    field_values = models.JSONField(default=dict, blank=True)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='department_records',
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='department_records_created',
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='department_records_updated',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ['-created_at']

    def get_previous_department_record(self):
        if self.source_batch_id:
            return self.source_batch.source_record
        if self.source_record_id:
            return self.source_record

        source_department = self.department.get_source_department()
        if not source_department or not self.melting_lot_id:
            return None

        return DepartmentRecord.objects.filter(
            department=source_department,
            melting_lot_id=self.melting_lot_id,
            user_id=self.user_id,
            is_active=True,
        ).order_by('-created_at').first()

    @property
    def input_weight(self):
        if self.input_weight_override is not None:
            return self.input_weight_override
        previous_record = self.get_previous_department_record()
        if previous_record:
            return previous_record.out_weight
        return self.melting_lot.gross_weight

    @property
    def metal_receipt_purity(self):
        receipt = self.melting_lot.metal_receipt_replica or getattr(self.melting_lot.metal_receipt, 'replica', None)
        if receipt:
            return receipt.melting_purity
        if self.melting_lot.metal_receipt:
            return self.melting_lot.metal_receipt.melting_purity
        return 0

    @property
    def tounch_number(self):
        if self.melting_lot.metal_receipt_replica_id:
            return self.melting_lot.metal_receipt_replica.source_receipt_id
        return self.melting_lot.metal_receipt_id

    @property
    def balance(self):
        balance = self.input_weight - self.out_weight - self.tounch
        for field in self.department.fields.filter(
            field_type=FieldDefinition.FIELD_TYPE_NUMBER,
            affects_balance=True,
        ):
            raw_value = self.field_values.get(field.field_name)
            if raw_value in (None, ''):
                continue
            value = float(raw_value)
            if field.balance_operation == FieldDefinition.BALANCE_OPERATION_ADD:
                balance += value
            elif field.balance_operation == FieldDefinition.BALANCE_OPERATION_SUBTRACT:
                balance -= value
        return balance

    @property
    def balance_gross(self):
        return (self.balance * self.metal_receipt_purity) / 100

    @property
    def balance_fine(self):
        return (self.balance_gross * self.melting_lot.purity.purity_value) / 100

    def clean(self):
        if self.department.process.user_id != self.user_id:
            raise ValidationError('Department must belong to same user.')
        if not self.melting_lot:
            raise ValidationError('Melting lot is required.')
        if self.melting_lot.user_id != self.user_id:
            raise ValidationError('Melting lot must belong to same user.')
        if self.out_weight < 0:
            raise ValidationError('OUT weight cannot be negative.')
        if self.tounch < 0:
            raise ValidationError('Tounch cannot be negative.')
        if self.input_weight_override is not None and self.input_weight_override <= 0:
            raise ValidationError('Input weight must be greater than 0.')
        if self.out_weight + self.tounch > self.input_weight:
            raise ValidationError('Not possible')

        source_department = self.department.get_source_department()
        if source_department:
            if self.source_batch_id:
                if self.source_batch.source_record.department_id != source_department.id:
                    raise ValidationError('Source batch must belong to the previous department.')
                if self.source_batch.source_record.melting_lot_id != self.melting_lot_id:
                    raise ValidationError('Source batch must belong to the same melting lot.')
                if self.source_batch.source_record.user_id != self.user_id:
                    raise ValidationError('Source batch must belong to the same user.')
                if self.input_weight_override is None:
                    raise ValidationError('Input weight is required for forwarded records.')
                if self.input_weight_override > self.source_batch.forwarded_weight:
                    raise ValidationError('Not possible')
                if self.source_batch.child_records.filter(
                    department=self.department,
                    is_active=True,
                ).exclude(pk=self.pk).exists():
                    raise ValidationError('This OUT batch already exists in the next department.')
            elif self.source_record_id:
                if self.source_record.department_id != source_department.id:
                    raise ValidationError('Source record must belong to the previous department.')
                if self.source_record.melting_lot_id != self.melting_lot_id:
                    raise ValidationError('Source record must belong to the same melting lot.')
                if self.source_record.user_id != self.user_id:
                    raise ValidationError('Source record must belong to the same user.')
                if self.input_weight_override is None:
                    raise ValidationError('Input weight is required for forwarded records.')

                already_forwarded = self.source_record.next_department_records.filter(
                    department=self.department,
                    is_active=True,
                ).exclude(pk=self.pk).aggregate(total=Sum('input_weight_override')).get('total') or 0
                legacy_forwarded_records = DepartmentRecord.objects.filter(
                    department=self.department,
                    melting_lot=self.melting_lot,
                    source_record__isnull=True,
                    is_active=True,
                ).exclude(pk=self.pk)
                legacy_forwarded = sum(record.input_weight for record in legacy_forwarded_records)
                available_to_forward = self.source_record.out_weight - already_forwarded
                if self.input_weight_override > (available_to_forward - legacy_forwarded):
                    raise ValidationError('Not possible')
            elif not self.get_previous_department_record():
                raise ValidationError('Previous stage record is required for this melting lot.')

        if self.pk:
            created_batch_total = self.transfer_batches.aggregate(total=Sum('forwarded_weight')).get('total') or 0
            if self.out_weight < created_batch_total:
                raise ValidationError('OUT weight cannot be less than already forwarded weight.')

        allowed_fields = set(self.department.fields.values_list('field_name', flat=True))
        extra_keys = [key for key in self.field_values.keys() if key not in allowed_fields]
        if extra_keys:
            raise ValidationError(f'Invalid field_values keys for selected department: {extra_keys}')

    def save(self, *args, **kwargs):
        if self.source_batch_id:
            self.source_record = self.source_batch.source_record
            self.input_weight_override = self.source_batch.forwarded_weight
        if self.pk:
            legacy_forwarded_records = list(
                DepartmentRecord.objects.filter(
                    melting_lot=self.melting_lot,
                    user_id=self.user_id,
                    source_record__isnull=True,
                    is_active=True,
                ).exclude(pk=self.pk).select_related('department', 'department__process')
            )
            for forwarded_record in legacy_forwarded_records:
                source_department = forwarded_record.department.get_source_department()
                if not source_department or source_department.id != self.department_id:
                    continue

                DepartmentRecord.objects.filter(pk=forwarded_record.pk).update(
                    source_record=self,
                    input_weight_override=forwarded_record.input_weight,
                )

        self.full_clean()
        previous_out_weight = None
        if self.pk:
            previous_out_weight = DepartmentRecord.objects.filter(pk=self.pk).values_list('out_weight', flat=True).first()

        super().save(*args, **kwargs)

        if self.source_batch_id:
            return

        if previous_out_weight is None:
            if self.out_weight > 0:
                DepartmentRecordTransferBatch.objects.create(
                    source_record=self,
                    forwarded_weight=self.out_weight,
                    input_weight_snapshot=self.input_weight,
                    total_out_weight_snapshot=self.out_weight,
                    tounch_snapshot=self.tounch,
                    tounch_purity_snapshot=self.tounch_purity,
                    balance_snapshot=self.balance,
                    balance_gross_snapshot=self.balance_gross,
                    balance_fine_snapshot=self.balance_fine,
                    field_values_snapshot=self.field_values,
                )
            return

        if self.out_weight > previous_out_weight:
            DepartmentRecordTransferBatch.objects.create(
                source_record=self,
                forwarded_weight=self.out_weight - previous_out_weight,
                input_weight_snapshot=self.input_weight,
                total_out_weight_snapshot=self.out_weight,
                tounch_snapshot=self.tounch,
                tounch_purity_snapshot=self.tounch_purity,
                balance_snapshot=self.balance,
                balance_gross_snapshot=self.balance_gross,
                balance_fine_snapshot=self.balance_fine,
                field_values_snapshot=self.field_values,
            )


class DepartmentRecordTransferBatch(models.Model):
    source_record = models.ForeignKey(
        DepartmentRecord,
        on_delete=models.CASCADE,
        related_name='transfer_batches',
    )
    forwarded_weight = models.FloatField()
    input_weight_snapshot = models.FloatField(null=True, blank=True)
    total_out_weight_snapshot = models.FloatField(null=True, blank=True)
    tounch_snapshot = models.FloatField(null=True, blank=True)
    tounch_purity_snapshot = models.FloatField(null=True, blank=True)
    balance_snapshot = models.FloatField(null=True, blank=True)
    balance_gross_snapshot = models.FloatField(null=True, blank=True)
    balance_fine_snapshot = models.FloatField(null=True, blank=True)
    field_values_snapshot = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['id']
