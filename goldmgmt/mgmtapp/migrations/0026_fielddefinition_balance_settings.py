from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('mgmtapp', '0025_departmentrecord_tounch_purity'),
    ]

    operations = [
        migrations.AddField(
            model_name='fielddefinition',
            name='affects_balance',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='fielddefinition',
            name='balance_operation',
            field=models.CharField(blank=True, choices=[('add', 'Add'), ('subtract', 'Subtract')], max_length=10, null=True),
        ),
    ]
