from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('mgmtapp', '0029_departmentrecordtransferbatch_and_source_batch'),
    ]

    operations = [
        migrations.AddField(
            model_name='departmentrecordtransferbatch',
            name='balance_fine_snapshot',
            field=models.FloatField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='departmentrecordtransferbatch',
            name='balance_gross_snapshot',
            field=models.FloatField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='departmentrecordtransferbatch',
            name='balance_snapshot',
            field=models.FloatField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='departmentrecordtransferbatch',
            name='input_weight_snapshot',
            field=models.FloatField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='departmentrecordtransferbatch',
            name='total_out_weight_snapshot',
            field=models.FloatField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='departmentrecordtransferbatch',
            name='tounch_purity_snapshot',
            field=models.FloatField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='departmentrecordtransferbatch',
            name='tounch_snapshot',
            field=models.FloatField(blank=True, null=True),
        ),
    ]
