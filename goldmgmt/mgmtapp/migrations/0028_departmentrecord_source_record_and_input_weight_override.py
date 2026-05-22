from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('mgmtapp', '0027_meltinglotreceiptallocation'),
    ]

    operations = [
        migrations.AddField(
            model_name='departmentrecord',
            name='input_weight_override',
            field=models.FloatField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='departmentrecord',
            name='source_record',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, related_name='next_department_records', to='mgmtapp.departmentrecord'),
        ),
    ]
