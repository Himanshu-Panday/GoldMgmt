from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('mgmtapp', '0024_departmentrecord_tounch'),
    ]

    operations = [
        migrations.AddField(
            model_name='departmentrecord',
            name='tounch_purity',
            field=models.FloatField(default=0),
        ),
    ]
