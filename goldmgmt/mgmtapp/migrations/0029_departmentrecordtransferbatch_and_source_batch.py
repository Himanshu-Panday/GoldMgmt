from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('mgmtapp', '0028_departmentrecord_source_record_and_input_weight_override'),
    ]

    operations = [
        migrations.CreateModel(
            name='DepartmentRecordTransferBatch',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('forwarded_weight', models.FloatField()),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('source_record', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='transfer_batches', to='mgmtapp.departmentrecord')),
            ],
            options={
                'ordering': ['id'],
            },
        ),
        migrations.AddField(
            model_name='departmentrecord',
            name='source_batch',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, related_name='child_records', to='mgmtapp.departmentrecordtransferbatch'),
        ),
    ]
