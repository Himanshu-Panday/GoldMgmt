from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('mgmtapp', '0012_alter_departmentformconfig_unique_together_and_more'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='department',
            name='department_form_config',
        ),
    ]
