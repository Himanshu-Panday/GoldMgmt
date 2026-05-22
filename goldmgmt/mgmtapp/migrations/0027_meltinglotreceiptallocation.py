from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('mgmtapp', '0026_fielddefinition_balance_settings'),
    ]

    operations = [
        migrations.CreateModel(
            name='MeltingLotReceiptAllocation',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('required_weight', models.FloatField()),
                ('require_alloy_weight', models.FloatField()),
                ('melting_lot', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='receipt_allocations', to='mgmtapp.meltinglot')),
                ('metal_receipt', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='melting_lot_allocations', to='mgmtapp.metalreceipt')),
                ('metal_receipt_replica', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='melting_lot_allocations', to='mgmtapp.metalreceiptreplica')),
            ],
            options={
                'ordering': ['id'],
            },
        ),
    ]
