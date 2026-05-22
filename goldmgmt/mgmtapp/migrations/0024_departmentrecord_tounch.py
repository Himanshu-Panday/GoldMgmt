from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('mgmtapp', '0023_metalreceipt_receipt_no_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='departmentrecord',
            name='tounch',
            field=models.FloatField(default=0),
        ),
    ]
