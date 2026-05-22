from django.contrib import admin

from .models import Department, DepartmentRecord, FieldDefinition, MeltingLot, MetalReceipt, MetalReceiptReplica, ParentLot, Process, Product, Purity


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ('id', 'product_name', 'user', 'is_active', 'created_at')
    list_filter = ('is_active',)
    search_fields = ('product_name', 'user__username')


@admin.register(Process)
class ProcessAdmin(admin.ModelAdmin):
    list_display = ('id', 'process_name', 'product', 'user', 'sequence', 'is_active', 'created_at')
    list_filter = ('product', 'is_active')
    search_fields = ('process_name', 'user__username', 'product__product_name')


@admin.register(FieldDefinition)
class FieldDefinitionAdmin(admin.ModelAdmin):
    list_display = ('id', 'field_name', 'field_type', 'user', 'is_active', 'created_at', 'updated_at')
    list_filter = ('field_type', 'is_active')
    search_fields = ('field_name', 'user__username')


@admin.register(Department)
class DepartmentAdmin(admin.ModelAdmin):
    list_display = ('id', 'department_name', 'process', 'get_fields')
    list_filter = ('process',)
    search_fields = ('department_name', 'process__process_name', 'process__product__product_name')

    def get_fields(self, obj):
        return ', '.join(obj.fields.values_list('field_name', flat=True)) or '-'

    get_fields.short_description = 'Fields'


@admin.register(MetalReceipt)
class MetalReceiptAdmin(admin.ModelAdmin):
    list_display = (
        'id',
        'receipt_no',
        'accounts',
        'type',
        'date',
        'melting_purity',
        'in_weight',
        'out_weight',
        'balance_weight',
        'user',
        'is_active',
    )
    list_filter = ('type', 'is_active', 'date')
    search_fields = ('accounts', 'description', 'user__username')


@admin.register(Purity)
class PurityAdmin(admin.ModelAdmin):
    list_display = ('id', 'purity_value', 'date', 'user', 'is_active', 'created_at')
    list_filter = ('is_active', 'date')
    search_fields = ('user__username',)


@admin.register(MetalReceiptReplica)
class MetalReceiptReplicaAdmin(admin.ModelAdmin):
    list_display = (
        'id',
        'source_receipt',
        'receipt_no',
        'accounts',
        'type',
        'date',
        'in_weight',
        'out_weight',
        'balance_weight',
        'user',
        'is_active',
    )
    list_filter = ('type', 'is_active', 'date')
    search_fields = ('receipt_no', 'accounts', 'source_receipt__accounts', 'user__username')


@admin.register(ParentLot)
class ParentLotAdmin(admin.ModelAdmin):
    list_display = ('id', 'name', 'product', 'purity', 'date', 'user', 'is_active', 'created_at')
    list_filter = ('is_active', 'date', 'product')
    search_fields = ('name', 'product__product_name', 'user__username')


@admin.register(MeltingLot)
class MeltingLotAdmin(admin.ModelAdmin):
    list_display = (
        'id',
        'name',
        'date',
        'metal_receipt',
        'metal_receipt_replica',
        'purity',
        'hook_purity',
        'required_weight',
        'require_alloy_weight',
        'user',
        'is_active',
    )
    list_filter = ('is_active', 'date', 'purity')
    search_fields = ('name', 'user__username')


@admin.register(DepartmentRecord)
class DepartmentRecordAdmin(admin.ModelAdmin):
    list_display = (
        'id',
        'department',
        'melting_lot',
        'out_weight',
        'user',
        'created_by',
        'updated_by',
        'is_active',
        'created_at',
    )
    list_filter = ('is_active', 'department', 'created_at')
    search_fields = ('melting_lot__name', 'department__process__process_name')
