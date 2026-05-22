from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    DepartmentRecordViewSet,
    DepartmentViewSet,
    FieldDefinitionViewSet,
    MeltingLotViewSet,
    MetalReceiptViewSet,
    MetalReceiptReplicaViewSet,
    MgmtHomeAPIView,
    ParentLotViewSet,
    ProcessViewSet,
    ProductViewSet,
    PurityViewSet,
)

router = DefaultRouter()
router.register('products', ProductViewSet, basename='products')
router.register('processes', ProcessViewSet, basename='processes')
router.register('departments', DepartmentViewSet, basename='departments')
router.register('field-definitions', FieldDefinitionViewSet, basename='field-definitions')
router.register('department-records', DepartmentRecordViewSet, basename='department-records')
router.register('metal-receipts', MetalReceiptViewSet, basename='metal-receipts')
router.register('metal-receipt-replicas', MetalReceiptReplicaViewSet, basename='metal-receipt-replicas')
router.register('purities', PurityViewSet, basename='purities')
router.register('parent-lots', ParentLotViewSet, basename='parent-lots')
router.register('melting-lots', MeltingLotViewSet, basename='melting-lots')

urlpatterns = [
    path('home/', MgmtHomeAPIView.as_view(), name='mgmt_home'),
    path('', include(router.urls)),
]
