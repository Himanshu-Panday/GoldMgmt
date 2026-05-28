from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('mgmtapp', '0030_departmentrecordtransferbatch_snapshots'),
    ]

    operations = [
        migrations.AddField(
            model_name='departmentrecordtransferbatch',
            name='field_values_snapshot',
            field=models.JSONField(blank=True, default=dict),
        ),
    ]
