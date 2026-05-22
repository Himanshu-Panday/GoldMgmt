from django.db.models import Prefetch
from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Department, DepartmentRecord, FieldDefinition, MeltingLot, MetalReceipt, MetalReceiptReplica, ParentLot, Process, Product, Purity
from .serializers import (
    DepartmentRecordSerializer,
    DepartmentSerializer,
    FieldDefinitionSerializer,
    MeltingLotSerializer,
    MetalReceiptSerializer,
    MetalReceiptReplicaSerializer,
    ParentLotSerializer,
    ProcessSerializer,
    ProductSerializer,
    PuritySerializer,
)


class MgmtHomeAPIView(APIView):
    def get(self, request):
        return Response(
            {
                'message': 'Welcome to the mgmt API',
                'user': {
                    'id': request.user.id,
                    'username': request.user.username,
                    'email': request.user.email,
                },
                'counts': {
                    'products': Product.objects.filter(user=request.user, is_active=True).count(),
                    'processes': Process.objects.filter(user=request.user, is_active=True).count(),
                    'departments': Department.objects.filter(process__user=request.user).count(),
                    'metal_receipts': MetalReceipt.objects.filter(user=request.user, is_active=True).count(),
                    'purities': Purity.objects.filter(user=request.user, is_active=True).count(),
                    'parent_lots': ParentLot.objects.filter(user=request.user, is_active=True).count(),
                    'melting_lots': MeltingLot.objects.filter(user=request.user, is_active=True).count(),
                    'field_definitions': FieldDefinition.objects.filter(user=request.user, is_active=True).count(),
                },
            }
        )


class ProductViewSet(viewsets.ModelViewSet):
    serializer_class = ProductSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        departments = Department.objects.prefetch_related('fields')
        processes = Process.objects.filter(is_active=True).prefetch_related(
            Prefetch('departments', queryset=departments)
        )
        return Product.objects.filter(user=self.request.user, is_active=True).prefetch_related(
            Prefetch('processes', queryset=processes)
        )

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class ProcessViewSet(viewsets.ModelViewSet):
    serializer_class = ProcessSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = Process.objects.filter(
            user=self.request.user,
            is_active=True,
            product__is_active=True,
        ).select_related('product')
        product_id = self.request.query_params.get('product')

        if product_id:
            queryset = queryset.filter(product_id=product_id)

        return queryset.prefetch_related(
            Prefetch('departments', queryset=Department.objects.prefetch_related('fields'))
        )

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class DepartmentViewSet(viewsets.ModelViewSet):
    serializer_class = DepartmentSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = Department.objects.filter(
            process__user=self.request.user,
            process__is_active=True,
            process__product__is_active=True,
        ).select_related('process').prefetch_related('fields')
        process_id = self.request.query_params.get('process')

        if process_id:
            queryset = queryset.filter(process_id=process_id)

        return queryset


class FieldDefinitionViewSet(viewsets.ModelViewSet):
    serializer_class = FieldDefinitionSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return FieldDefinition.objects.filter(user=self.request.user, is_active=True)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class MetalReceiptViewSet(viewsets.ModelViewSet):
    serializer_class = MetalReceiptSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return MetalReceipt.objects.filter(user=self.request.user, is_active=True)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class MetalReceiptReplicaViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = MetalReceiptReplicaSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return MetalReceiptReplica.objects.filter(
            user=self.request.user,
            is_active=True,
            source_receipt__is_active=True,
        ).select_related('source_receipt')


class PurityViewSet(viewsets.ModelViewSet):
    serializer_class = PuritySerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Purity.objects.filter(user=self.request.user, is_active=True)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class ParentLotViewSet(viewsets.ModelViewSet):
    serializer_class = ParentLotSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return ParentLot.objects.filter(
            user=self.request.user,
            is_active=True,
            product__is_active=True,
            purity__is_active=True,
        ).select_related('product', 'purity')

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class MeltingLotViewSet(viewsets.ModelViewSet):
    serializer_class = MeltingLotSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return MeltingLot.objects.filter(
            user=self.request.user,
            is_active=True,
            purity__is_active=True,
        ).prefetch_related('products', 'parent_lots', 'receipt_allocations__metal_receipt').select_related('purity', 'metal_receipt', 'metal_receipt_replica')

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class DepartmentRecordViewSet(viewsets.ModelViewSet):
    serializer_class = DepartmentRecordSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = DepartmentRecord.objects.filter(
            user=self.request.user,
            is_active=True,
        ).select_related(
            'department',
            'department__process',
            'department__process__product',
            'melting_lot',
            'melting_lot__purity',
            'melting_lot__metal_receipt',
            'melting_lot__metal_receipt_replica',
            'melting_lot__metal_receipt_replica__source_receipt',
            'created_by',
        ).prefetch_related(
            'department__fields',
            'melting_lot__parent_lots',
            'melting_lot__receipt_allocations__metal_receipt',
            'transfer_batches__source_record__melting_lot__purity',
        )
        department_id = self.request.query_params.get('department')
        if department_id:
            queryset = queryset.filter(department_id=department_id)
        return queryset

    def perform_create(self, serializer):
        serializer.save(
            user=self.request.user,
            created_by=self.request.user,
            updated_by=self.request.user,
        )

    def perform_update(self, serializer):
        serializer.save(updated_by=self.request.user)
