import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, Navigate, Route, Routes, useNavigate, useParams } from 'react-router-dom'

type AuthResponse = {
  message: string
  redirect_to?: string
  user: { id: number; username: string; email: string }
  tokens: { access: string; refresh: string }
}

type FieldDefinition = {
  id: number
  field_name: string
  field_type: 'text' | 'number' | 'date' | 'boolean'
  affects_balance: boolean
  balance_operation: 'add' | 'subtract' | null
  created_at: string
  updated_at: string
  is_active: boolean
}

type FieldValue = string | number | boolean

type Department = {
  id: number
  process: number
  department_name: string
  previous_department_id: number | null
  field_ids: number[]
  fields: FieldDefinition[]
}

type Process = {
  id: number
  product: number
  process_name: string
  created_at: string
  sequence: number
  departments: Department[]
}

type Product = {
  id: number
  product_name: string
  created_at: string
  processes: Process[]
}

type MetalReceipt = {
  id: number
  receipt_no: string
  accounts: string
  type: string
  date: string
  description: string
  melting_purity: number
  in_weight: number
  out_weight: number
  balance_weight: number
  created_at: string
  is_active: boolean
}

type MetalReceiptReplica = {
  id: number
  source_receipt: number
  receipt_no: string
  accounts: string
  type: string
  date: string
  description: string
  melting_purity: number
  in_weight: number
  balance_weight: number
  created_at: string
  is_active: boolean
}

type Purity = {
  id: number
  purity_value: number
  date: string
  created_at: string
  is_active: boolean
}

type ParentLot = {
  id: number
  name: string
  product: number
  purity: number
  date: string
  created_at: string
  is_active: boolean
}

type MeltingLot = {
  id: number
  name: string
  date: string
  products: number[]
  parent_lots: number[]
  metal_receipt: number | null
  metal_receipt_replica: number | null
  purity: number
  description: string
  hook_purity: number
  required_weight: number
  require_alloy_weight: number
  receipt_allocation_details: ReceiptRow[]
  gross_weight: number
  is_active: boolean
}

type ReceiptRow = {
  receipt_no: string | null
  accounts: string | null
  type: string | null
  date: string | null
  description: string | null
  melting_purity: number
  in_weight: number | null
  balance_weight: number | null
  required_weight: number
  require_alloy_weight: number
}

type DepartmentRecordPayload = {
  department: number
  melting_lot: number
  source_record?: number
  source_batch?: number
  input_weight_override?: number
  out_weight: number
  tounch: number
  tounch_purity: number
  field_values: Record<string, FieldValue>
  is_active: boolean
}

type DepartmentRecord = {
  id: number
  department: number
  melting_lot: number
  source_record: number | null
  source_batch: number | null
  input_weight_override: number | null
  product_name: string
  process_name: string
  department_name: string
  lot_no: string
  lot_purity: number
  parent_lot_names: string[]
  in_weight: number
  metal_receipt_purity: number
  out_weight: number
  tounch_number: number | null
  receipt_no: string | null
  receipt_accounts: string | null
  receipt_type: string | null
  receipt_date: string | null
  receipt_description: string | null
  receipt_in_weight: number | null
  receipt_balance_weight: number | null
  receipt_rows: ReceiptRow[]
  transfer_batches: {
    id: number
    lot_no?: string | null
    lot_purity?: number | null
    input_weight?: number | null
    forwarded_weight: number
    total_out_weight?: number | null
    tounch_number?: number | null
    tounch?: number | null
    tounch_purity?: number | null
    balance?: number | null
    balance_gross?: number | null
    balance_fine?: number | null
    field_values?: Record<string, FieldValue>
    saved_at?: string | null
  }[]
  tounch: number
  tounch_purity: number
  balance: number
  balance_gross: number
  balance_fine: number
  date: string
  field_values: Record<string, FieldValue>
  department_fields: FieldDefinition[]
  created_by_username: string
  created_at: string
  updated_at: string
  is_active: boolean
}

type DepartmentSourceRow = {
  key: string
  melting_lot: number
  source_record: number | null
  source_batch: number | null
  lot_no: string
  lot_purity: number
  in_weight: number
  metal_receipt_purity: number
  tounch_number: number | null
  parent_lot_names: string[]
  receipt_no: string | null
  receipt_accounts: string | null
  receipt_type: string | null
  receipt_date: string | null
  receipt_description: string | null
  receipt_in_weight: number | null
  receipt_balance_weight: number | null
  receipt_rows: ReceiptRow[]
  date: string
  created_by_username: string
}

type DepartmentDisplayRow = {
  key: string
  mode: 'saved' | 'draft'
  record: DepartmentRecord | null
  sourceRow: DepartmentSourceRow
}

type DepartmentRecordDraftContext = {
  department: number
  melting_lot: number
  source_record: number | null
  source_batch: number | null
  product_name: string
  process_name: string
  department_name: string
  lot_no: string
  lot_purity: number
  parent_lot_names: string[]
  in_weight: number
  metal_receipt_purity: number
  receipt_no: string | null
  receipt_accounts: string | null
  receipt_type: string | null
  receipt_date: string | null
  receipt_description: string | null
  receipt_in_weight: number | null
  receipt_balance_weight: number | null
  receipt_rows: ReceiptRow[]
  transfer_batches: {
    id: number
    lot_no?: string | null
    lot_purity?: number | null
    input_weight?: number | null
    forwarded_weight: number
    total_out_weight?: number | null
    tounch_number?: number | null
    tounch?: number | null
    tounch_purity?: number | null
    balance?: number | null
    balance_gross?: number | null
    balance_fine?: number | null
    field_values?: Record<string, FieldValue>
    saved_at?: string | null
  }[]
  department_fields: FieldDefinition[]
  out_weight: number
  tounch: number
  tounch_purity: number
  field_values: Record<string, FieldValue>
}

type MeltingLotReceiptAllocationDraft = {
  metal_receipt_replica: number
  required_weight: number
}

type MgmtHomeResponse = {
  message: string
  user: { id: number; username: string; email: string }
  counts: {
    products: number
    processes: number
    departments: number
    metal_receipts?: number
    purities?: number
    parent_lots?: number
    melting_lots?: number
    field_definitions?: number
  }
}

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL?.trim() || '').replace(/\/$/, '')

function getAccessToken() {
  return localStorage.getItem('access_token')
}

function getRefreshToken() {
  return localStorage.getItem('refresh_token')
}

function saveTokens(access: string, refresh: string) {
  localStorage.setItem('access_token', access)
  localStorage.setItem('refresh_token', refresh)
}

function saveUser(username: string) {
  localStorage.setItem('username', username)
}

function clearSession() {
  localStorage.removeItem('access_token')
  localStorage.removeItem('refresh_token')
  localStorage.removeItem('username')
}

async function login(username: string, password: string): Promise<AuthResponse> {
  let response: Response

  try {
    response = await fetch(`${API_BASE_URL}/api/auth/login/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    })
  } catch {
    throw new Error('Cannot reach the backend API. Start Django on http://127.0.0.1:8000 and try again.')
  }

  const payload = await response.json()

  if (!response.ok) {
    throw new Error(payload.detail ?? 'Login failed')
  }

  return payload
}

async function register(username: string, email: string, password: string): Promise<AuthResponse> {
  let response: Response

  try {
    response = await fetch(`${API_BASE_URL}/api/auth/register/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, password }),
    })
  } catch {
    throw new Error('Cannot reach the backend API. Start Django on http://127.0.0.1:8000 and try again.')
  }

  const payload = await response.json()

  if (!response.ok) {
    const firstError = Object.values(payload)[0]
    throw new Error(Array.isArray(firstError) ? String(firstError[0]) : 'Registration failed')
  }

  return payload
}

async function refreshAccessToken() {
  const refresh = getRefreshToken()
  if (!refresh) {
    return null
  }

  let response: Response

  try {
    response = await fetch(`${API_BASE_URL}/api/auth/token/refresh/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh }),
    })
  } catch {
    clearSession()
    return null
  }

  if (!response.ok) {
    clearSession()
    return null
  }

  const payload = await response.json()
  const access = payload.access as string
  localStorage.setItem('access_token', access)
  return access
}

async function apiRequest(path: string, options: RequestInit = {}) {
  let access = getAccessToken()
  let response: Response

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers: {
        ...(options.headers ?? {}),
        Authorization: `Bearer ${access}`,
        'Content-Type': 'application/json',
      },
    })
  } catch {
    throw new Error('Cannot reach the backend API. Start Django on http://127.0.0.1:8000 and try again.')
  }

  if (response.status === 401) {
    access = await refreshAccessToken()

    if (!access) {
      throw new Error('Session expired. Please login again.')
    }

    try {
      response = await fetch(`${API_BASE_URL}${path}`, {
        ...options,
        headers: {
          ...(options.headers ?? {}),
          Authorization: `Bearer ${access}`,
          'Content-Type': 'application/json',
        },
      })
    } catch {
      throw new Error('Cannot reach the backend API. Start Django on http://127.0.0.1:8000 and try again.')
    }
  }

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}))
    const firstError = Object.values(payload)[0]

    if (typeof firstError === 'string') {
      throw new Error(firstError)
    }

    if (Array.isArray(firstError)) {
      throw new Error(String(firstError[0]))
    }

    throw new Error('Request failed')
  }

  return response
}

async function fetchMgmtHome(): Promise<MgmtHomeResponse> {
  const response = await apiRequest('/api/mgmt/home/')
  return response.json()
}

async function fetchProducts(): Promise<Product[]> {
  const response = await apiRequest('/api/mgmt/products/')
  return response.json()
}

async function fetchFieldDefinitions(): Promise<FieldDefinition[]> {
  const response = await apiRequest('/api/mgmt/field-definitions/')
  return response.json()
}

async function fetchMetalReceipts(): Promise<MetalReceipt[]> {
  const response = await apiRequest('/api/mgmt/metal-receipts/')
  return response.json()
}

async function fetchMetalReceiptReplicas(): Promise<MetalReceiptReplica[]> {
  const response = await apiRequest('/api/mgmt/metal-receipt-replicas/')
  return response.json()
}

async function fetchPurities(): Promise<Purity[]> {
  const response = await apiRequest('/api/mgmt/purities/')
  return response.json()
}

async function fetchParentLots(): Promise<ParentLot[]> {
  const response = await apiRequest('/api/mgmt/parent-lots/')
  return response.json()
}

async function fetchMeltingLots(): Promise<MeltingLot[]> {
  const response = await apiRequest('/api/mgmt/melting-lots/')
  return response.json()
}

async function fetchMeltingLot(lotId: number): Promise<MeltingLot> {
  const response = await apiRequest(`/api/mgmt/melting-lots/${lotId}/`)
  return response.json()
}

async function fetchDepartmentRecords(departmentId: number): Promise<DepartmentRecord[]> {
  const response = await apiRequest(`/api/mgmt/department-records/?department=${departmentId}`)
  return response.json()
}

async function fetchDepartmentRecord(recordId: number): Promise<DepartmentRecord> {
  const response = await apiRequest(`/api/mgmt/department-records/${recordId}/`)
  return response.json()
}

async function createDepartmentRecord(payload: DepartmentRecordPayload & { department: number; melting_lot: number }) {
  const response = await apiRequest('/api/mgmt/department-records/', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return response.json() as Promise<DepartmentRecord>
}

async function updateDepartmentRecord(recordId: number, payload: DepartmentRecordPayload & { department: number; melting_lot: number }) {
  const response = await apiRequest(`/api/mgmt/department-records/${recordId}/`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
  return response.json() as Promise<DepartmentRecord>
}

const DEPARTMENT_RECORD_DRAFT_STORAGE_KEY = 'department-record-draft'
const DEPARTMENT_RECORD_UPDATE_SIGNAL_KEY = 'department-record-updated'

function buildDepartmentFieldPayload(
  draftValues: Record<string, string>,
  fields: FieldDefinition[],
): Record<string, FieldValue> {
  return Object.fromEntries(
    Object.entries(draftValues).map(([fieldName, rawValue]) => {
      const field = fields.find((item) => item.field_name === fieldName)

      if (!field || rawValue === '') {
        return [fieldName, rawValue]
      }

      if (field.field_type === 'number') {
        return [fieldName, Number(rawValue)]
      }

      if (field.field_type === 'boolean') {
        return [fieldName, rawValue === 'true']
      }

      return [fieldName, rawValue]
    }),
  )
}

function calculateFieldBalanceAdjustment(
  fields: FieldDefinition[],
  fieldValues: Record<string, string>,
) {
  return fields.reduce((total, field) => {
    if (field.field_type !== 'number' || !field.affects_balance || !field.balance_operation) {
      return total
    }

    const rawValue = fieldValues[field.field_name]
    if (rawValue === undefined || rawValue === null || rawValue === '') {
      return total
    }

    const parsedValue = Number(rawValue)
    if (Number.isNaN(parsedValue)) {
      return total
    }

    if (field.balance_operation === 'add') {
      return total + parsedValue
    }

    return total - parsedValue
  }, 0)
}

function calculateDepartmentBalances(
  inWeight: number,
  outWeight: number,
  tounch: number,
  fieldBalanceAdjustment: number,
  metalReceiptPurity: number,
  lotPurity: number,
) {
  const balance = inWeight - outWeight - tounch + fieldBalanceAdjustment
  const balanceGross = (balance * metalReceiptPurity) / 100
  const balanceFine = (balanceGross * lotPurity) / 100

  return { balance, balanceGross, balanceFine }
}

function roundWeight(value: number) {
  return Math.round(value * 1000) / 1000
}

function formatWeight(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '--'
  }

  return roundWeight(value).toFixed(3)
}

function calculateRequiredAlloyWeight(
  metalReceipt: MetalReceiptReplica | null,
  meltingPurity: Purity | null,
  requiredWeight: number,
) {
  if (!metalReceipt || !meltingPurity || requiredWeight <= 0) {
    return null
  }

  const pureGoldWeight = (metalReceipt.in_weight * metalReceipt.melting_purity) / 100
  const totalWeight = (pureGoldWeight / meltingPurity.purity_value) * 100
  const totalAlloyWeight = totalWeight - metalReceipt.in_weight
  const requiredAlloyWeight = roundWeight((requiredWeight * totalAlloyWeight) / metalReceipt.in_weight)

  return {
    requiredAlloyWeight,
    isPossible: requiredAlloyWeight >= 0,
  }
}

function LandingPage() {
  return (
    <div className="landing">
      <p className="eyebrow">Gold Management Platform</p>
      <h1>Secure Authentication Portal</h1>
      <p className="lead">
        This frontend is prepared for your `authapp` API. Users can register or login,
        receive JWT tokens, and move to the management area after successful authentication.
      </p>
      <div className="cta-row">
        <Link className="btn primary" to="/auth">Open Auth View</Link>
        <a className="btn ghost" href={`${API_BASE_URL}/api/auth/me/`} target="_blank" rel="noreferrer">
          Test Auth Endpoint
        </a>
      </div>
    </div>
  )
}

function AuthPage() {
  const navigate = useNavigate()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError('')

    try {
      const payload =
        mode === 'login'
          ? await login(username, password)
          : await register(username, email, password)

      saveTokens(payload.tokens.access, payload.tokens.refresh)
      saveUser(payload.user.username)
      navigate(payload.redirect_to ?? '/mgmt')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-layout">
      <aside className="auth-panel">
        <p className="eyebrow">Auth App</p>
        <h2>{mode === 'login' ? 'Sign In' : 'Create Account'}</h2>
        <p>JWT-based authentication connected to the Django backend.</p>
        <div className="switch-row">
          <button className={mode === 'login' ? 'pill active' : 'pill'} onClick={() => setMode('login')} type="button">Login</button>
          <button className={mode === 'register' ? 'pill active' : 'pill'} onClick={() => setMode('register')} type="button">Register</button>
        </div>
      </aside>

      <form className="auth-form" onSubmit={onSubmit}>
        <label>
          Username
          <input value={username} onChange={(e) => setUsername(e.target.value)} required />
        </label>

        {mode === 'register' && (
          <label>
            Email
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>
        )}

        <label>
          Password
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required />
        </label>

        {error && <p className="error">{error}</p>}

        <button className="btn primary" disabled={busy} type="submit">
          {busy ? 'Processing...' : mode === 'login' ? 'Login' : 'Register'}
        </button>

        <Link className="muted-link" to="/">Back to Landing</Link>
      </form>
    </div>
  )
}

function MgmtPage() {
  const navigate = useNavigate()
  const [homeData, setHomeData] = useState<MgmtHomeResponse | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [fieldDefinitions, setFieldDefinitions] = useState<FieldDefinition[]>([])
  const [metalReceipts, setMetalReceipts] = useState<MetalReceipt[]>([])
  const [metalReceiptReplicas, setMetalReceiptReplicas] = useState<MetalReceiptReplica[]>([])
  const [purities, setPurities] = useState<Purity[]>([])
  const [parentLots, setParentLots] = useState<ParentLot[]>([])
  const [meltingLots, setMeltingLots] = useState<MeltingLot[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const [productName, setProductName] = useState('')
  const [processName, setProcessName] = useState('')
  const [fieldName, setFieldName] = useState('')
  const [fieldType, setFieldType] = useState<'text' | 'number' | 'date' | 'boolean'>('text')
  const [fieldAffectsBalance, setFieldAffectsBalance] = useState(false)
  const [fieldBalanceOperation, setFieldBalanceOperation] = useState<'add' | 'subtract'>('add')
  const [departmentName, setDepartmentName] = useState('')
  const [selectedFieldIds, setSelectedFieldIds] = useState<number[]>([])

  const [mrAccounts, setMrAccounts] = useState('')
  const [mrType, setMrType] = useState('')
  const [mrDescription, setMrDescription] = useState('')
  const [mrMeltingPurity, setMrMeltingPurity] = useState('')
  const [mrInWeight, setMrInWeight] = useState('')
  const [purityValue, setPurityValue] = useState('')
  const [parentLotProductId, setParentLotProductId] = useState('')
  const [parentLotPurityId, setParentLotPurityId] = useState('')
  const [meltingDescription, setMeltingDescription] = useState('')
  const [meltingHookPurity, setMeltingHookPurity] = useState('')
  const [meltingPurityId, setMeltingPurityId] = useState('')
  const [meltingSelectedProducts, setMeltingSelectedProducts] = useState<number[]>([])
  const [meltingSelectedParentLots, setMeltingSelectedParentLots] = useState<number[]>([])
  const [meltingSelectedMetalReceiptReplicaIds, setMeltingSelectedMetalReceiptReplicaIds] = useState<number[]>([])
  const [meltingRequiredWeightsByReceipt, setMeltingRequiredWeightsByReceipt] = useState<Record<number, string>>({})

  const [selectedProductId, setSelectedProductId] = useState<number | null>(null)
  const [selectedProcessId, setSelectedProcessId] = useState<number | null>(null)
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<number | null>(null)
  const [departmentRecords, setDepartmentRecords] = useState<DepartmentRecord[]>([])
  const [sourceDepartmentRecords, setSourceDepartmentRecords] = useState<DepartmentRecord[]>([])

  const [draftFieldValuesByLot, setDraftFieldValuesByLot] = useState<Record<string, Record<string, string>>>({})
  const [draftOutWeightsByLot, setDraftOutWeightsByLot] = useState<Record<string, string>>({})
  const [draftTounchByLot, setDraftTounchByLot] = useState<Record<string, string>>({})
  const [draftTounchPurityByLot, setDraftTounchPurityByLot] = useState<Record<string, string>>({})

  const [activeTab, setActiveTab] = useState<'product' | 'field_definition' | 'metal_receipt' | 'purity' | 'parent_lot' | 'melting_lot'>('product')
  const [productPageView, setProductPageView] = useState<'products' | 'processes' | 'departments' | 'department_records'>('products')
  const [showProductForm, setShowProductForm] = useState(false)
  const [showProcessForm, setShowProcessForm] = useState(false)
  const [showDepartmentForm, setShowDepartmentForm] = useState(false)
  const [showFieldDefinitionForm, setShowFieldDefinitionForm] = useState(false)
  const [showMetalReceiptForm, setShowMetalReceiptForm] = useState(false)
  const [showPurityForm, setShowPurityForm] = useState(false)
  const [showParentLotForm, setShowParentLotForm] = useState(false)
  const [showMeltingLotForm, setShowMeltingLotForm] = useState(false)
  const [expandedSidebarTab, setExpandedSidebarTab] = useState<'product' | null>(null)
  const [sidebarSelectedProductId, setSidebarSelectedProductId] = useState<number | null>(null)
  const [sidebarExpandedProcessId, setSidebarExpandedProcessId] = useState<number | null>(null)
  const [lineageProductId, setLineageProductId] = useState<number | null>(null)
  const [lineageProcessId, setLineageProcessId] = useState<number | null>(null)

  const selectedProduct = useMemo(
    () => products.find((product) => product.id === selectedProductId) ?? null,
    [products, selectedProductId],
  )
  const selectedProcess = useMemo(
    () => selectedProduct?.processes.find((process) => process.id === selectedProcessId) ?? null,
    [selectedProduct, selectedProcessId],
  )
  const selectedDepartment = useMemo(
    () => selectedProcess?.departments.find((department) => department.id === selectedDepartmentId) ?? null,
    [selectedProcess, selectedDepartmentId],
  )
  const allProductDepartments = useMemo(
    () => selectedProduct?.processes.flatMap((process) => process.departments) ?? [],
    [selectedProduct],
  )
  const previousDepartment = useMemo(
    () => (
      selectedDepartment?.previous_department_id
        ? allProductDepartments.find((department) => department.id === selectedDepartment.previous_department_id) ?? null
        : null
    ),
    [allProductDepartments, selectedDepartment],
  )
  const nextDepartmentTarget = useMemo(() => {
    if (!selectedDepartment || !selectedProcess || !selectedProduct) {
      return null
    }

    const departmentIndex = selectedProcess.departments.findIndex((department) => department.id === selectedDepartment.id)
    const nextDepartmentInProcess = departmentIndex >= 0 ? selectedProcess.departments[departmentIndex + 1] ?? null : null
    if (nextDepartmentInProcess) {
      return { processId: selectedProcess.id, departmentId: nextDepartmentInProcess.id, departmentName: nextDepartmentInProcess.department_name }
    }

    const processIndex = selectedProduct.processes.findIndex((process) => process.id === selectedProcess.id)
    const nextProcess = processIndex >= 0 ? selectedProduct.processes[processIndex + 1] ?? null : null
    const nextProcessFirstDepartment = nextProcess?.departments[0] ?? null
    if (!nextProcess || !nextProcessFirstDepartment) {
      return null
    }

    return {
      processId: nextProcess.id,
      departmentId: nextProcessFirstDepartment.id,
      departmentName: nextProcessFirstDepartment.department_name,
    }
  }, [selectedDepartment, selectedProcess, selectedProduct])
  const selectedMeltingPurity = useMemo(
    () => purities.find((purity) => purity.id === Number(meltingPurityId)) ?? null,
    [purities, meltingPurityId],
  )
  const meltingReceiptPreviews = useMemo(
    () =>
      Object.fromEntries(
        metalReceiptReplicas.map((receipt) => {
          const rawRequiredWeight = meltingRequiredWeightsByReceipt[receipt.id] ?? ''
          const requiredWeight = rawRequiredWeight === '' ? 0 : Number(rawRequiredWeight)
          return [
            receipt.id,
            calculateRequiredAlloyWeight(receipt, selectedMeltingPurity, requiredWeight),
          ]
        }),
      ) as Record<number, ReturnType<typeof calculateRequiredAlloyWeight>>,
    [meltingRequiredWeightsByReceipt, metalReceiptReplicas, selectedMeltingPurity],
  )
  const meltingReceiptTotals = useMemo(() => {
    return meltingSelectedMetalReceiptReplicaIds.reduce(
      (totals, receiptId) => {
        const rawRequiredWeight = meltingRequiredWeightsByReceipt[receiptId] ?? ''
        const requiredWeight = rawRequiredWeight === '' ? 0 : Number(rawRequiredWeight)
        const preview = meltingReceiptPreviews[receiptId]

        if (!Number.isNaN(requiredWeight) && requiredWeight > 0) {
          totals.requiredWeight += requiredWeight
        }
        if (preview) {
          totals.requiredAlloyWeight += preview.requiredAlloyWeight
        }
        totals.requiredWeight = roundWeight(totals.requiredWeight)
        totals.requiredAlloyWeight = roundWeight(totals.requiredAlloyWeight)
        totals.grossWeight = roundWeight(totals.requiredWeight + totals.requiredAlloyWeight)

        return totals
      },
      { requiredWeight: 0, requiredAlloyWeight: 0, grossWeight: 0 },
    )
  }, [meltingReceiptPreviews, meltingRequiredWeightsByReceipt, meltingSelectedMetalReceiptReplicaIds])
  const departmentMeltingLots = useMemo(
    () => (selectedProductId ? meltingLots.filter((lot) => lot.products.includes(selectedProductId)) : []),
    [meltingLots, selectedProductId],
  )
  const filteredParentLots = useMemo(
    () =>
      meltingSelectedProducts.length === 0
        ? parentLots
        : parentLots.filter((lot) => meltingSelectedProducts.includes(lot.product)),
    [parentLots, meltingSelectedProducts],
  )
  const departmentSourceRows = useMemo<DepartmentSourceRow[]>(() => {
    if (!selectedDepartment) {
      return []
    }

    if (previousDepartment) {
      return sourceDepartmentRecords.flatMap((record) => {
        return record.transfer_batches
          .filter((batch) => !departmentRecords.some((currentRecord) => currentRecord.source_batch === batch.id))
          .map((batch) => ({
            key: `batch-${batch.id}`,
            melting_lot: record.melting_lot,
            source_record: record.id,
            source_batch: batch.id,
            lot_no: record.lot_no,
            lot_purity: record.lot_purity,
            parent_lot_names: record.parent_lot_names,
            in_weight: batch.forwarded_weight,
            metal_receipt_purity: record.metal_receipt_purity,
            tounch_number: record.tounch_number,
            receipt_no: record.receipt_no,
            receipt_accounts: record.receipt_accounts,
            receipt_type: record.receipt_type,
            receipt_date: record.receipt_date,
            receipt_description: record.receipt_description,
            receipt_in_weight: record.receipt_in_weight,
            receipt_balance_weight: record.receipt_balance_weight,
            receipt_rows: record.receipt_rows,
            date: record.date,
            created_by_username: record.created_by_username,
          }))
      })
    }

    const isFirstProcessFirstDepartment =
      selectedProcess?.sequence === 1
      && selectedProcess.departments[0]?.id === selectedDepartment.id

    if (!isFirstProcessFirstDepartment) {
      return []
    }

    return departmentMeltingLots.map((lot) => ({
      key: `lot-${lot.id}`,
      melting_lot: lot.id,
      source_record: null,
      source_batch: null,
      lot_no: lot.name,
      lot_purity: purities.find((purity) => purity.id === lot.purity)?.purity_value ?? 0,
      parent_lot_names: parentLots.filter((parentLot) => lot.parent_lots.includes(parentLot.id)).map((parentLot) => parentLot.name),
      in_weight: lot.gross_weight,
      metal_receipt_purity:
        metalReceiptReplicas.find((receipt) => receipt.id === lot.metal_receipt_replica)?.melting_purity ?? 0,
      tounch_number:
        metalReceiptReplicas.find((receipt) => receipt.id === lot.metal_receipt_replica)?.source_receipt ?? lot.metal_receipt,
      receipt_no: metalReceipts.find((receipt) => receipt.id === lot.metal_receipt)?.receipt_no ?? null,
      receipt_accounts: metalReceipts.find((receipt) => receipt.id === lot.metal_receipt)?.accounts ?? null,
      receipt_type: metalReceipts.find((receipt) => receipt.id === lot.metal_receipt)?.type ?? null,
      receipt_date: metalReceipts.find((receipt) => receipt.id === lot.metal_receipt)?.date ?? null,
      receipt_description: metalReceipts.find((receipt) => receipt.id === lot.metal_receipt)?.description ?? null,
      receipt_in_weight: metalReceipts.find((receipt) => receipt.id === lot.metal_receipt)?.in_weight ?? null,
      receipt_balance_weight: metalReceipts.find((receipt) => receipt.id === lot.metal_receipt)?.balance_weight ?? null,
      receipt_rows: lot.receipt_allocation_details,
      date: lot.date,
      created_by_username: homeData?.user.username ?? '-',
    }))
  }, [
    departmentRecords,
    departmentMeltingLots,
    homeData?.user.username,
    metalReceiptReplicas,
    metalReceipts,
    parentLots,
    previousDepartment,
    purities,
    selectedProcess,
    selectedDepartment,
    sourceDepartmentRecords,
  ])
  const departmentDisplayRows = useMemo<DepartmentDisplayRow[]>(() => {
    if (!selectedDepartment) {
      return []
    }

    if (previousDepartment) {
      const savedRows = departmentRecords.map((record) => ({
        key: `saved-${record.id}`,
        mode: 'saved' as const,
        record,
        sourceRow: {
          key: `saved-${record.id}`,
          melting_lot: record.melting_lot,
          source_record: record.source_record,
          source_batch: record.source_batch,
          lot_no: record.lot_no,
          lot_purity: record.lot_purity,
          parent_lot_names: record.parent_lot_names,
          in_weight: record.in_weight,
          metal_receipt_purity: record.metal_receipt_purity,
          tounch_number: record.tounch_number,
          receipt_no: record.receipt_no,
          receipt_accounts: record.receipt_accounts,
          receipt_type: record.receipt_type,
          receipt_date: record.receipt_date,
          receipt_description: record.receipt_description,
          receipt_in_weight: record.receipt_in_weight,
          receipt_balance_weight: record.receipt_balance_weight,
          receipt_rows: record.receipt_rows,
          date: record.date,
          created_by_username: record.created_by_username,
        },
      }))
      const draftRows = departmentSourceRows.map((sourceRow) => ({
        key: sourceRow.key,
        mode: 'draft' as const,
        record: null,
        sourceRow,
      }))

      return [...savedRows, ...draftRows]
    }

    return departmentSourceRows.map((sourceRow) => {
      const existingRecord = departmentRecords.find((record) => record.melting_lot === sourceRow.melting_lot)
      return {
        key: existingRecord ? `saved-${existingRecord.id}` : sourceRow.key,
        mode: existingRecord ? 'saved' as const : 'draft' as const,
        record: existingRecord ?? null,
        sourceRow,
      }
    })
  }, [departmentRecords, departmentSourceRows, previousDepartment, selectedDepartment])

  async function refreshActiveDepartmentData() {
    if (productPageView !== 'department_records' || !selectedDepartmentId) {
      return
    }

    const sourceDepartmentId = selectedDepartment?.previous_department_id ?? null
    try {
      const [currentRecords, previousRecords] = await Promise.all([
        fetchDepartmentRecords(selectedDepartmentId),
        sourceDepartmentId ? fetchDepartmentRecords(sourceDepartmentId) : Promise.resolve([] as DepartmentRecord[]),
      ])
      setDepartmentRecords(currentRecords)
      setSourceDepartmentRecords(previousRecords)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to refresh department records')
    }
  }

  async function loadMgmtData() {
    setLoading(true)
    setError('')

    try {
      const [home, productList, fieldList, metalReceiptList, metalReceiptReplicaList, purityList, parentLotList, meltingLotList] = await Promise.all([
        fetchMgmtHome(),
        fetchProducts(),
        fetchFieldDefinitions(),
        fetchMetalReceipts(),
        fetchMetalReceiptReplicas(),
        fetchPurities(),
        fetchParentLots(),
        fetchMeltingLots(),
      ])

      setHomeData(home)
      setProducts(productList)
      setFieldDefinitions(fieldList)
      setMetalReceipts(metalReceiptList)
      setMetalReceiptReplicas(metalReceiptReplicaList)
      setPurities(purityList)
      setParentLots(parentLotList)
      setMeltingLots(meltingLotList)

      if (productList.length > 0) {
        setSelectedProductId((prev) => (
          prev && productList.some((product) => product.id === prev) ? prev : productList[0].id
        ))
      } else {
        setSelectedProductId(null)
        setSelectedProcessId(null)
        setSelectedDepartmentId(null)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!getAccessToken()) {
      navigate('/auth')
      return
    }

    loadMgmtData()
  }, [navigate])

  useEffect(() => {
    function handleDepartmentRecordUpdated(event: StorageEvent) {
      if (event.key !== DEPARTMENT_RECORD_UPDATE_SIGNAL_KEY) {
        return
      }

      loadMgmtData()
      refreshActiveDepartmentData()
    }

    function handleWindowFocus() {
      loadMgmtData()
      refreshActiveDepartmentData()
    }

    window.addEventListener('storage', handleDepartmentRecordUpdated)
    window.addEventListener('focus', handleWindowFocus)

    return () => {
      window.removeEventListener('storage', handleDepartmentRecordUpdated)
      window.removeEventListener('focus', handleWindowFocus)
    }
  }, [productPageView, selectedDepartmentId, selectedDepartment])

  useEffect(() => {
    if (!selectedProduct) {
      setSelectedProcessId(null)
      setSelectedDepartmentId(null)
      return
    }

    if (!selectedProcessId || !selectedProduct.processes.some((process) => process.id === selectedProcessId)) {
      setSelectedProcessId(null)
      setSelectedDepartmentId(null)
    }
  }, [selectedProduct, selectedProcessId])

  useEffect(() => {
    setMeltingSelectedParentLots((prev) =>
      prev.filter((lotId) => filteredParentLots.some((lot) => lot.id === lotId)),
    )
  }, [filteredParentLots])

  async function onCreateProduct(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError('')

    try {
      const response = await apiRequest('/api/mgmt/products/', {
        method: 'POST',
        body: JSON.stringify({ product_name: productName }),
      })
      const createdProduct = (await response.json()) as Product
      setProducts((prev) => [createdProduct, ...prev])
      setSelectedProductId(createdProduct.id)
      setProductName('')
      setShowProductForm(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create product')
    } finally {
      setBusy(false)
    }
  }

  async function onCreateProcess(event: FormEvent) {
    event.preventDefault()
    if (!selectedProductId) return

    setBusy(true)
    setError('')

    try {
      const response = await apiRequest('/api/mgmt/processes/', {
        method: 'POST',
        body: JSON.stringify({ product: selectedProductId, process_name: processName }),
      })
      const createdProcess = (await response.json()) as Process

      setProducts((prev) =>
        prev.map((product) =>
          product.id === selectedProductId
            ? {
                ...product,
                processes: [...product.processes, createdProcess].sort((a, b) => a.sequence - b.sequence),
              }
            : product,
        ),
      )

      setSelectedProcessId(createdProcess.id)
      setProcessName('')
      setShowProcessForm(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create process')
    } finally {
      setBusy(false)
    }
  }

  async function onCreateFieldDefinition(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError('')

    try {
      const response = await apiRequest('/api/mgmt/field-definitions/', {
        method: 'POST',
        body: JSON.stringify({
          field_name: fieldName,
          field_type: fieldType,
          affects_balance: fieldType === 'number' ? fieldAffectsBalance : false,
          balance_operation: fieldType === 'number' && fieldAffectsBalance ? fieldBalanceOperation : null,
          is_active: true,
        }),
      })
      const createdField = (await response.json()) as FieldDefinition
      setFieldDefinitions((prev) => [...prev, createdField].sort((a, b) => a.field_name.localeCompare(b.field_name)))
      setFieldName('')
      setFieldType('text')
      setFieldAffectsBalance(false)
      setFieldBalanceOperation('add')
      setShowFieldDefinitionForm(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create field')
    } finally {
      setBusy(false)
    }
  }

  async function onCreateDepartment(event: FormEvent) {
    event.preventDefault()
    if (!selectedProductId || !selectedProcessId || !departmentName.trim() || selectedFieldIds.length === 0) return

    setBusy(true)
    setError('')

    try {
      const response = await apiRequest('/api/mgmt/departments/', {
        method: 'POST',
        body: JSON.stringify({
          process: selectedProcessId,
          department_name: departmentName.trim(),
          field_ids: selectedFieldIds,
        }),
      })
      const createdDepartment = (await response.json()) as Department

      setProducts((prev) =>
        prev.map((product) =>
          product.id === selectedProductId
            ? {
                ...product,
                processes: product.processes.map((process) =>
                  process.id === selectedProcessId
                    ? { ...process, departments: [...process.departments, createdDepartment] }
                    : process,
                ),
              }
            : product,
        ),
      )

      setSelectedDepartmentId(createdDepartment.id)
      setDepartmentName('')
      setSelectedFieldIds([])
      setShowDepartmentForm(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create department')
    } finally {
      setBusy(false)
    }
  }

  async function onCreateMetalReceipt(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError('')

    try {
      const response = await apiRequest('/api/mgmt/metal-receipts/', {
        method: 'POST',
        body: JSON.stringify({
          accounts: mrAccounts,
          type: mrType,
          description: mrDescription,
          melting_purity: Number(mrMeltingPurity),
          in_weight: Number(mrInWeight),
          is_active: true,
        }),
      })
      const createdReceipt = (await response.json()) as MetalReceipt
      setMetalReceipts((prev) => [createdReceipt, ...prev])
      setMrAccounts('')
      setMrType('')
      setMrDescription('')
      setMrMeltingPurity('')
      setMrInWeight('')
      setShowMetalReceiptForm(false)
      loadMgmtData()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create metal receipt')
    } finally {
      setBusy(false)
    }
  }

  async function onCreatePurity(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError('')

    try {
      const response = await apiRequest('/api/mgmt/purities/', {
        method: 'POST',
        body: JSON.stringify({ purity_value: Number(purityValue), is_active: true }),
      })
      const createdPurity = (await response.json()) as Purity
      setPurities((prev) => [createdPurity, ...prev])
      setPurityValue('')
      setShowPurityForm(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create purity')
    } finally {
      setBusy(false)
    }
  }

  async function onCreateParentLot(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError('')

    try {
      const response = await apiRequest('/api/mgmt/parent-lots/', {
        method: 'POST',
        body: JSON.stringify({
          product: Number(parentLotProductId),
          purity: Number(parentLotPurityId),
          is_active: true,
        }),
      })
      const createdParentLot = (await response.json()) as ParentLot
      setParentLots((prev) => [createdParentLot, ...prev])
      setParentLotProductId('')
      setParentLotPurityId('')
      setShowParentLotForm(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create parent lot')
    } finally {
      setBusy(false)
    }
  }

  async function onCreateMeltingLot(event: FormEvent) {
    event.preventDefault()

    if (meltingSelectedMetalReceiptReplicaIds.length === 0) {
      setError('Please select at least one metal receipt.')
      return
    }

    if (!selectedMeltingPurity) {
      setError('Please select a purity.')
      return
    }

    setBusy(true)
    setError('')

    try {
      const receiptAllocations: MeltingLotReceiptAllocationDraft[] = []
      let totalRequiredAlloyWeight = 0

      for (const receiptId of meltingSelectedMetalReceiptReplicaIds) {
        const receipt = metalReceiptReplicas.find((item) => item.id === receiptId)
        if (!receipt) {
          throw new Error('Invalid metal receipt selection.')
        }

        const rawRequiredWeight = meltingRequiredWeightsByReceipt[receiptId] ?? ''
        if (rawRequiredWeight === '') {
          throw new Error(`Required weight is required for ${receipt.receipt_no}.`)
        }

        const requiredWeight = Number(rawRequiredWeight)
        if (Number.isNaN(requiredWeight) || requiredWeight <= 0) {
          throw new Error(`Required weight must be greater than 0 for ${receipt.receipt_no}.`)
        }

        if (requiredWeight > receipt.in_weight) {
          throw new Error(
            `Required weight cannot exceed selected metal receipt in weight (${receipt.in_weight}) for ${receipt.receipt_no}.`,
          )
        }

        const alloyCalculation = calculateRequiredAlloyWeight(receipt, selectedMeltingPurity, requiredWeight)
        if (!alloyCalculation) {
          throw new Error(`Required alloy weight could not be calculated for ${receipt.receipt_no}.`)
        }

        receiptAllocations.push({
          metal_receipt_replica: receiptId,
          required_weight: requiredWeight,
        })
        totalRequiredAlloyWeight += alloyCalculation.requiredAlloyWeight
      }

      if (totalRequiredAlloyWeight <= 0) {
        const message = 'Not possible'
        setError(message)
        window.alert(message)
        return
      }

      const response = await apiRequest('/api/mgmt/melting-lots/', {
        method: 'POST',
        body: JSON.stringify({
          products: meltingSelectedProducts,
          parent_lots: meltingSelectedParentLots,
          receipt_allocations: receiptAllocations,
          purity: Number(meltingPurityId),
          description: meltingDescription,
          hook_purity: Number(meltingHookPurity),
          is_active: true,
        }),
      })
      const createdMeltingLot = (await response.json()) as MeltingLot
      setMeltingLots((prev) => [createdMeltingLot, ...prev])
      setMeltingDescription('')
      setMeltingHookPurity('')
      setMeltingPurityId('')
      setMeltingSelectedProducts([])
      setMeltingSelectedParentLots([])
      setMeltingSelectedMetalReceiptReplicaIds([])
      setMeltingRequiredWeightsByReceipt({})
      setShowMeltingLotForm(false)
      loadMgmtData()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create melting lot')
    } finally {
      setBusy(false)
    }
  }

  function onOpenDepartment(departmentId: number, processId?: number) {
    const targetProcessId = processId ?? selectedProcess?.id ?? null
    const targetProcess = selectedProduct?.processes.find((process) => process.id === targetProcessId) ?? null
    const targetDepartment = targetProcess?.departments.find((department) => department.id === departmentId) ?? null
    const sourceDepartmentId = targetDepartment?.previous_department_id ?? null

    if (targetProcessId) {
      setSelectedProcessId(targetProcessId)
    }
    setSelectedDepartmentId(departmentId)
    setProductPageView('department_records')
    setDraftFieldValuesByLot({})
    setDraftOutWeightsByLot({})
    setDraftTounchByLot({})
    setDraftTounchPurityByLot({})

    Promise.all([
      fetchDepartmentRecords(departmentId),
      sourceDepartmentId ? fetchDepartmentRecords(sourceDepartmentId) : Promise.resolve([] as DepartmentRecord[]),
    ])
      .then(([currentRecords, previousRecords]) => {
        setDepartmentRecords(currentRecords)
        setSourceDepartmentRecords(previousRecords)
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load department records'))
  }

  function onOpenDepartmentRecordWindow(existingRecord: DepartmentRecord | null, sourceRow: DepartmentSourceRow) {
    if (existingRecord) {
      window.open(`/mgmt/department-record/${existingRecord.id}`, '_blank', 'noopener,noreferrer')
      return
    }

    if (!selectedDepartment || !selectedProcess || !selectedProduct) {
      return
    }

    const draftContext: DepartmentRecordDraftContext = {
      department: selectedDepartment.id,
      melting_lot: sourceRow.melting_lot,
      source_record: sourceRow.source_record,
      source_batch: sourceRow.source_batch,
      product_name: selectedProduct.product_name,
      process_name: selectedProcess.process_name,
      department_name: selectedDepartment.department_name,
      lot_no: sourceRow.lot_no,
      lot_purity: sourceRow.lot_purity,
      parent_lot_names: sourceRow.parent_lot_names,
      in_weight: sourceRow.in_weight,
      metal_receipt_purity: sourceRow.metal_receipt_purity,
      receipt_no: sourceRow.receipt_no,
      receipt_accounts: sourceRow.receipt_accounts,
      receipt_type: sourceRow.receipt_type,
      receipt_date: sourceRow.receipt_date,
      receipt_description: sourceRow.receipt_description,
      receipt_in_weight: sourceRow.receipt_in_weight,
      receipt_balance_weight: sourceRow.receipt_balance_weight,
      receipt_rows: sourceRow.receipt_rows,
      transfer_batches: [],
      department_fields: selectedDepartment.fields,
      out_weight: draftOutWeightsByLot[sourceRow.key] === '' || draftOutWeightsByLot[sourceRow.key] === undefined
        ? 0
        : Number(draftOutWeightsByLot[sourceRow.key]),
      tounch: draftTounchByLot[sourceRow.key] === '' || draftTounchByLot[sourceRow.key] === undefined
        ? 0
        : Number(draftTounchByLot[sourceRow.key]),
      tounch_purity: draftTounchPurityByLot[sourceRow.key] === '' || draftTounchPurityByLot[sourceRow.key] === undefined
        ? 0
        : Number(draftTounchPurityByLot[sourceRow.key]),
      field_values: buildDepartmentFieldPayload(
        draftFieldValuesByLot[sourceRow.key] ?? {},
        selectedDepartment.fields,
      ),
    }

    const draftKey = `${selectedDepartment.id}-${sourceRow.melting_lot}-${Date.now()}`
    localStorage.setItem(`${DEPARTMENT_RECORD_DRAFT_STORAGE_KEY}:${draftKey}`, JSON.stringify(draftContext))
    window.open(`/mgmt/department-record-draft/${draftKey}`, '_blank', 'noopener,noreferrer')
  }

  async function onSubmitDepartmentRecordForRow(sourceRow: DepartmentSourceRow) {
    if (!selectedDepartmentId) return
    const outWeightValue = draftOutWeightsByLot[sourceRow.key] ?? ''
    const tounchValue = draftTounchByLot[sourceRow.key] ?? ''
    const tounchPurityValue = draftTounchPurityByLot[sourceRow.key] ?? ''

    if (outWeightValue === '') {
      setError('OUT weight is required.')
      return
    }

    const outWeight = Number(outWeightValue)
    if (Number.isNaN(outWeight) || outWeight < 0) {
      setError('OUT weight must be a valid non-negative number.')
      return
    }
    const tounch = tounchValue === '' ? 0 : Number(tounchValue)
    if (Number.isNaN(tounch) || tounch < 0) {
      setError('Tounch must be a valid non-negative number.')
      return
    }
    if (tounchPurityValue === '') {
      setError('Tounch purity is required.')
      return
    }
    const tounchPurity = Number(tounchPurityValue)
    if (Number.isNaN(tounchPurity) || tounchPurity < 0) {
      setError('Tounch purity must be a valid non-negative number.')
      return
    }
    if (sourceRow && outWeight + tounch > sourceRow.in_weight) {
      const message = 'Not possible'
      setError(message)
      window.alert(message)
      return
    }

    setBusy(true)
    setError('')

    try {
      const currentSourceRows = departmentSourceRows
      const payload: DepartmentRecordPayload = {
        department: selectedDepartmentId,
        melting_lot: sourceRow.melting_lot,
        source_record: sourceRow.source_record ?? undefined,
        source_batch: sourceRow.source_batch ?? undefined,
        input_weight_override: sourceRow.source_record ? sourceRow.in_weight : undefined,
        out_weight: outWeight,
        tounch,
        tounch_purity: tounchPurity,
        field_values: buildDepartmentFieldPayload(
          draftFieldValuesByLot[sourceRow.key] ?? {},
          selectedDepartment?.fields ?? [],
        ),
        is_active: true,
      }
      const response = await apiRequest('/api/mgmt/department-records/', {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      const createdRecord = (await response.json()) as DepartmentRecord
      localStorage.setItem(DEPARTMENT_RECORD_UPDATE_SIGNAL_KEY, String(Date.now()))
      setDepartmentRecords((prev) => [createdRecord, ...prev])
      setDraftFieldValuesByLot((prev) => {
        const next = { ...prev }
        delete next[sourceRow.key]
        return next
      })
      setDraftOutWeightsByLot((prev) => {
        const next = { ...prev }
        delete next[sourceRow.key]
        return next
      })
      setDraftTounchByLot((prev) => {
        const next = { ...prev }
        delete next[sourceRow.key]
        return next
      })
      setDraftTounchPurityByLot((prev) => {
        const next = { ...prev }
        delete next[sourceRow.key]
        return next
      })

      const remainingUnsubmittedRows = currentSourceRows.filter((row) => row.key !== sourceRow.key)

      if (nextDepartmentTarget && remainingUnsubmittedRows.length === 0) {
        onOpenDepartment(nextDepartmentTarget.departmentId, nextDepartmentTarget.processId)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to submit department record')
    } finally {
      setBusy(false)
    }
  }

  function renderLineage(product: Product) {
    const selectedLineageProcess =
      product.processes.find((process) => process.id === lineageProcessId) ?? null

    return (
      <div className="lineage-drawer">
        {product.processes.length === 0 && <p className="muted">No process records yet.</p>}
        {product.processes.length > 0 && (
          <>
            <div className="record-list">
              {product.processes.map((process, index) => (
                <div key={process.id} className="record-main solo">
                  <button
                    className={lineageProcessId === process.id ? 'btn primary' : 'btn'}
                    type="button"
                    onClick={() => setLineageProcessId(process.id)}
                  >
                    {`#${process.sequence} ${process.process_name}`}
                  </button>
                  {index < product.processes.length - 1 && <small className="muted">↓</small>}
                </div>
              ))}
            </div>

            {selectedLineageProcess && (
              <div className="record-main solo active">
                <strong>{`Process #${selectedLineageProcess.sequence}: ${selectedLineageProcess.process_name}`}</strong>
                {selectedLineageProcess.departments.length === 0 && <small>No departments yet.</small>}
                {selectedLineageProcess.departments.length > 0 && (
                  <div className="record-list">
                    {selectedLineageProcess.departments.map((department) => (
                      <div key={department.id} className="record-main solo">
                        <strong>{department.department_name}</strong>
                        <small>{department.fields.map((field) => field.field_name).join(', ') || 'No fields'}</small>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    )
  }

  function onSelectSidebarProduct(productId: number) {
    if (sidebarSelectedProductId === productId) {
      setSidebarSelectedProductId(null)
      setSidebarExpandedProcessId(null)
      setSelectedProductId(null)
      setSelectedProcessId(null)
      setSelectedDepartmentId(null)
      setProductPageView('products')
      return
    }

    setSidebarSelectedProductId(productId)
    setSidebarExpandedProcessId(null)
    setSelectedProductId(productId)
    setSelectedProcessId(null)
    setSelectedDepartmentId(null)
    setProductPageView('processes')
  }

  function onSelectSidebarProcess(processId: number) {
    if (sidebarExpandedProcessId === processId) {
      setSidebarExpandedProcessId(null)
      setSelectedProcessId(null)
      setSelectedDepartmentId(null)
      setProductPageView('processes')
      return
    }

    setSidebarExpandedProcessId(processId)
    setSelectedProcessId(processId)
    setSelectedDepartmentId(null)
    setProductPageView('departments')
  }

  function onSelectSidebarDepartment(productId: number, processId: number, departmentId: number) {
    setSidebarSelectedProductId(productId)
    setSidebarExpandedProcessId(processId)
    setSelectedProductId(productId)
    onOpenDepartment(departmentId, processId)
  }

  if (loading) {
    return (
      <section className="mgmt-card">
        <p>Loading management dashboard...</p>
      </section>
    )
  }

  return (
    <section className="mgmt-shell">
      <aside className="mgmt-sidebar">
        <p className="eyebrow">Management</p>
        <button
          className={activeTab === 'product' ? 'sidebar-btn active' : 'sidebar-btn'}
          type="button"
          onClick={() => {
            setActiveTab('product')
            setProductPageView('products')
            setExpandedSidebarTab((prev) => (prev === 'product' ? null : 'product'))
            if (expandedSidebarTab === 'product') {
              setSidebarSelectedProductId(null)
              setSidebarExpandedProcessId(null)
            }
          }}
        >
          Product
        </button>
        {activeTab === 'product' && expandedSidebarTab === 'product' && (
          <div className="sidebar-tree">
            <div className="sidebar-tree-group">
              {products.length === 0 && <p className="muted sidebar-tree-empty">No products yet.</p>}
              {products.map((product) => (
                <div className="sidebar-product-group" key={product.id}>
                  <button
                    type="button"
                    className={selectedProductId === product.id ? 'sidebar-subbtn sidebar-tree-node sidebar-tree-node-product sidebar-tree-trigger active' : 'sidebar-subbtn sidebar-tree-node sidebar-tree-node-product sidebar-tree-trigger'}
                    onClick={() => onSelectSidebarProduct(product.id)}
                  >
                    <span className="sidebar-tree-label">{product.product_name}</span>
                    <small>{product.processes.length} processes</small>
                  </button>
                  {sidebarSelectedProductId === product.id && (
                    <div className="sidebar-process-list">
                      {product.processes.length === 0 && <p className="muted sidebar-tree-empty">No process records yet.</p>}
                      {product.processes.map((process) => (
                        <div key={process.id} className="sidebar-process-node">
                          <button
                            type="button"
                            className={selectedProcessId === process.id ? 'sidebar-subbtn sidebar-subbtn-child sidebar-tree-node sidebar-tree-node-process sidebar-tree-trigger active' : 'sidebar-subbtn sidebar-subbtn-child sidebar-tree-node sidebar-tree-node-process sidebar-tree-trigger'}
                            onClick={() => onSelectSidebarProcess(process.id)}
                          >
                            <span className="sidebar-tree-label">{`#${process.sequence} ${process.process_name}`}</span>
                            <small>{process.departments.length} departments</small>
                          </button>
                          {sidebarExpandedProcessId === process.id && (
                            <div className="sidebar-department-list">
                              {process.departments.length === 0 && <p className="muted sidebar-tree-empty">No departments yet.</p>}
                              {process.departments.map((department) => (
                                <button
                                  key={department.id}
                                  type="button"
                                  className={selectedDepartmentId === department.id ? 'sidebar-subbtn sidebar-subbtn-child sidebar-tree-node sidebar-tree-node-department sidebar-tree-leaf active' : 'sidebar-subbtn sidebar-subbtn-child sidebar-tree-node sidebar-tree-node-department sidebar-tree-leaf'}
                                  onClick={() => onSelectSidebarDepartment(product.id, process.id, department.id)}
                                >
                                  <span className="sidebar-tree-label">{department.department_name}</span>
                                  <small>{department.fields.length} fields</small>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
        <button className={activeTab === 'field_definition' ? 'sidebar-btn active' : 'sidebar-btn'} type="button" onClick={() => {
          setActiveTab('field_definition')
          setExpandedSidebarTab(null)
          setSidebarSelectedProductId(null)
        }}>
          Field Definitions
        </button>
        <button className={activeTab === 'metal_receipt' ? 'sidebar-btn active' : 'sidebar-btn'} type="button" onClick={() => {
          setActiveTab('metal_receipt')
          setExpandedSidebarTab(null)
          setSidebarSelectedProductId(null)
        }}>
          Metal Receipt
        </button>
        <button className={activeTab === 'purity' ? 'sidebar-btn active' : 'sidebar-btn'} type="button" onClick={() => {
          setActiveTab('purity')
          setExpandedSidebarTab(null)
          setSidebarSelectedProductId(null)
        }}>
          Purity
        </button>
        <button className={activeTab === 'parent_lot' ? 'sidebar-btn active' : 'sidebar-btn'} type="button" onClick={() => {
          setActiveTab('parent_lot')
          setExpandedSidebarTab(null)
          setSidebarSelectedProductId(null)
        }}>
          Parent Lots
        </button>
        <button className={activeTab === 'melting_lot' ? 'sidebar-btn active' : 'sidebar-btn'} type="button" onClick={() => {
          setActiveTab('melting_lot')
          setExpandedSidebarTab(null)
          setSidebarSelectedProductId(null)
        }}>
          Melting Lot
        </button>

        {activeTab === 'product' && <p className="muted sidebar-meta">{homeData?.counts.products ?? products.length} products</p>}
        {activeTab === 'field_definition' && <p className="muted sidebar-meta">{homeData?.counts.field_definitions ?? fieldDefinitions.length} fields</p>}
        {activeTab === 'metal_receipt' && <p className="muted sidebar-meta">{homeData?.counts.metal_receipts ?? metalReceipts.length} receipts</p>}
        {activeTab === 'purity' && <p className="muted sidebar-meta">{homeData?.counts.purities ?? purities.length} purities</p>}
        {activeTab === 'parent_lot' && <p className="muted sidebar-meta">{homeData?.counts.parent_lots ?? parentLots.length} parent lots</p>}
        {activeTab === 'melting_lot' && <p className="muted sidebar-meta">{homeData?.counts.melting_lots ?? meltingLots.length} melting lots</p>}

        {error && <p className="error">{error}</p>}

        <button
          className="btn"
          type="button"
          onClick={() => {
            clearSession()
            navigate('/auth')
          }}
        >
          Logout
        </button>
      </aside>

      <div className="mgmt-content">
        {activeTab === 'product' && (
          <div className="single-panel">
            {productPageView === 'products' && (
              <article className="mgmt-card">
                <div className="panel-head">
                  <h3>Product List</h3>
                  <button className="btn primary" type="button" onClick={() => setShowProductForm((prev) => !prev)}>
                    {showProductForm ? 'Close' : 'Create Product'}
                  </button>
                </div>

                {showProductForm && (
                  <form className="stack-form" onSubmit={onCreateProduct}>
                    <label>
                      Product Name
                      <input value={productName} onChange={(e) => setProductName(e.target.value)} required />
                    </label>
                    <button className="btn primary" disabled={busy} type="submit">Save Product</button>
                  </form>
                )}

                <div className="record-list">
                  {products.length === 0 && <p className="muted">No products yet.</p>}
                  {products.map((product) => (
                    <div className="record-item-wrap" key={product.id}>
                      <div className={selectedProductId === product.id ? 'record-item active' : 'record-item'}>
                        <button
                          type="button"
                          className="record-main"
                          onClick={() => {
                            setSelectedProductId(product.id)
                            setSelectedProcessId(null)
                            setProductPageView('processes')
                          }}
                        >
                          <strong>{product.product_name}</strong>
                          <small>Processes: {product.processes.length}</small>
                        </button>
                        <button
                          type="button"
                          className="btn"
                          onClick={() => {
                            const nextLineageProductId = lineageProductId === product.id ? null : product.id
                            setLineageProductId(nextLineageProductId)
                            setLineageProcessId(nextLineageProductId ? product.processes[0]?.id ?? null : null)
                          }}
                        >
                          Lineage
                        </button>
                      </div>
                      {lineageProductId === product.id && renderLineage(product)}
                    </div>
                  ))}
                </div>
              </article>
            )}

            {productPageView === 'processes' && selectedProduct && (
              <article className="mgmt-card">
                <div className="panel-head">
                  <h3>Process List</h3>
                  <div className="cta-row">
                    <button className="btn" type="button" onClick={() => setProductPageView('products')}>Back</button>
                    <button className="btn primary" type="button" onClick={() => setShowProcessForm((prev) => !prev)}>
                      {showProcessForm ? 'Close' : 'Create Process'}
                    </button>
                  </div>
                </div>

                <p className="muted">Selected Product: <strong>{selectedProduct.product_name}</strong></p>

                {showProcessForm && (
                  <form className="stack-form" onSubmit={onCreateProcess}>
                    <label>
                      Process Name
                      <input value={processName} onChange={(e) => setProcessName(e.target.value)} required />
                    </label>
                    <button className="btn primary" disabled={busy} type="submit">Save Process</button>
                  </form>
                )}

                <div className="record-list">
                  {selectedProduct.processes.length === 0 && <p className="muted">No process records yet.</p>}
                  {selectedProduct.processes.map((process) => (
                    <button
                      key={process.id}
                      type="button"
                      className={selectedProcessId === process.id ? 'record-main solo active' : 'record-main solo'}
                      onClick={() => {
                        setSelectedProcessId(process.id)
                        setSelectedDepartmentId(null)
                        setProductPageView('departments')
                      }}
                    >
                      <strong>#{process.sequence} {process.process_name}</strong>
                      <small>Departments: {process.departments.length}</small>
                    </button>
                  ))}
                </div>
              </article>
            )}

            {productPageView === 'departments' && selectedProcess && (
              <article className="mgmt-card">
                <div className="panel-head">
                  <h3>Department List</h3>
                  <div className="cta-row">
                    <button className="btn" type="button" onClick={() => setProductPageView('processes')}>Back</button>
                    <button className="btn primary" type="button" onClick={() => setShowDepartmentForm((prev) => !prev)}>
                      {showDepartmentForm ? 'Close' : 'Create Department'}
                    </button>
                  </div>
                </div>

                <p className="muted">Selected Process: <strong>{selectedProcess.process_name}</strong></p>

                {showDepartmentForm && (
                  <form className="stack-form" onSubmit={onCreateDepartment}>
                    <label>
                      Department Name
                      <input value={departmentName} onChange={(e) => setDepartmentName(e.target.value)} required />
                    </label>
                    <label>Department Fields</label>
                    <div className="record-list">
                      {fieldDefinitions.length === 0 && <p className="muted">No fields available yet.</p>}
                      {fieldDefinitions.map((field) => (
                        <label key={field.id} className="record-main solo">
                          <input
                            type="checkbox"
                            checked={selectedFieldIds.includes(field.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedFieldIds((prev) => [...prev, field.id])
                              } else {
                                setSelectedFieldIds((prev) => prev.filter((id) => id !== field.id))
                              }
                            }}
                          />
                          <strong>{field.field_name}</strong>
                          <small>Type: {field.field_type}</small>
                        </label>
                      ))}
                    </div>
                    <button className="btn primary" disabled={busy} type="submit">Save Department</button>
                  </form>
                )}

                <div className="record-list">
                  {selectedProcess.departments.length === 0 && <p className="muted">No departments yet.</p>}
                  {selectedProcess.departments.map((department) => (
                    <button
                      key={department.id}
                      type="button"
                      className={selectedDepartmentId === department.id ? 'record-main solo active' : 'record-main solo'}
                      onClick={() => onOpenDepartment(department.id, selectedProcess.id)}
                    >
                      <strong>{department.department_name}</strong>
                      <small>Fields: {department.fields.map((field) => field.field_name).join(', ') || 'None'}</small>
                    </button>
                  ))}
                </div>
              </article>
            )}

            {productPageView === 'department_records' && selectedProcess && selectedDepartment && (
              <article className="mgmt-card">
                <div className="panel-head">
                  <h3>{selectedDepartment.department_name}</h3>
                  <div className="cta-row">
                    <button className="btn" type="button" onClick={() => setProductPageView('departments')}>Back</button>
                  </div>
                </div>

                <p className="muted">
                  Selected Process: <strong>{selectedProcess.process_name}</strong>
                </p>

                <div className="stack-form">
                  <p className="muted">
                    {previousDepartment
                      ? <>Rows below come from <strong>{previousDepartment.department_name}</strong>. The next department `IN` value is taken from the previous department `OUT`, and you only fill the custom columns for <strong>{selectedDepartment.department_name}</strong>.</>
                      : <>All melting lots for the selected product are shown below. Fixed columns come from the melting lot, and you only fill the custom columns for <strong>{selectedDepartment.department_name}</strong>.</>}
                  </p>
                  {nextDepartmentTarget && (
                    <p className="muted">
                      Saved rows from <strong>{selectedDepartment.department_name}</strong> will become available in <strong>{nextDepartmentTarget.departmentName}</strong>.
                    </p>
                  )}
                  <div className="table-wrap">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Open</th>
                          <th>LOT No</th>
                          <th>Lot purity</th>
                          <th>IN</th>
                          <th>OUT</th>
                          <th>Balance</th>
                          <th>Balance Gross</th>
                          <th>Balance Fine</th>
                          <th>Date</th>
                          <th>Created_by</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {departmentDisplayRows.length === 0 && (
                          <tr>
                            <td colSpan={11}>
                              {previousDepartment
                                ? 'No saved records found in the previous department for this process yet.'
                                : 'No melting lots found for this product yet.'}
                            </td>
                          </tr>
                        )}
                        {departmentDisplayRows.map(({ key, mode, record: existingRecord, sourceRow }) => {
                          const draftValues = draftFieldValuesByLot[sourceRow.key] ?? {}
                          const draftOutWeight = draftOutWeightsByLot[sourceRow.key] ?? ''
                          const draftTounch = draftTounchByLot[sourceRow.key] ?? ''
                          const parsedDraftOutWeight = draftOutWeight === '' ? null : Number(draftOutWeight)
                          const parsedDraftTounch = draftTounch === '' ? 0 : Number(draftTounch)
                          const fieldBalanceAdjustment = calculateFieldBalanceAdjustment(selectedDepartment.fields, draftValues)
                          const previewMetrics =
                            parsedDraftOutWeight !== null && !Number.isNaN(parsedDraftOutWeight) && !Number.isNaN(parsedDraftTounch)
                              ? calculateDepartmentBalances(
                                  sourceRow.in_weight,
                                  parsedDraftOutWeight,
                                  parsedDraftTounch,
                                  fieldBalanceAdjustment,
                                  sourceRow.metal_receipt_purity,
                                  sourceRow.lot_purity,
                                )
                              : null

                          return (
                            <tr key={key}>
                              <td>
                                <button
                                  className="btn"
                                  type="button"
                                  onClick={() => onOpenDepartmentRecordWindow(existingRecord ?? null, sourceRow)}
                                >
                                  View
                                </button>
                              </td>
                              <td>{existingRecord?.lot_no ?? sourceRow.lot_no}</td>
                              <td>{existingRecord?.lot_purity ?? sourceRow.lot_purity}</td>
                              <td>{existingRecord?.in_weight ?? sourceRow.in_weight}</td>
                              <td>
                                {existingRecord ? (
                                  existingRecord.out_weight
                                ) : (
                                  <input
                                    type="number"
                                    step="0.0001"
                                    min="0"
                                    value={draftOutWeight}
                                    onChange={(e) =>
                                      setDraftOutWeightsByLot((prev) => ({
                                        ...prev,
                                        [sourceRow.key]: e.target.value,
                                      }))
                                    }
                                  />
                                )}
                              </td>
                              <td>{existingRecord ? existingRecord.balance : previewMetrics?.balance ?? '-'}</td>
                              <td>{existingRecord ? existingRecord.balance_gross : previewMetrics?.balanceGross ?? '-'}</td>
                              <td>{existingRecord ? existingRecord.balance_fine : previewMetrics?.balanceFine ?? '-'}</td>
                              <td>{existingRecord ? new Date(existingRecord.date).toLocaleDateString() : new Date(sourceRow.date).toLocaleDateString()}</td>
                              <td>{existingRecord?.created_by_username ?? sourceRow.created_by_username}</td>
                              <td>
                                {mode === 'saved' && existingRecord ? (
                                  <span>Saved</span>
                                ) : (
                                  <button
                                    className="btn primary"
                                    disabled={busy}
                                    type="button"
                                    onClick={() => onSubmitDepartmentRecordForRow(sourceRow)}
                                  >
                                    Add
                                  </button>
                                )}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {departmentRecords.length === 0 && (
                  <p className="muted">No department records yet.</p>
                )}
              </article>
            )}
          </div>
        )}

        {activeTab === 'field_definition' && (
          <article className="mgmt-card">
            <div className="panel-head">
              <h3>Field Definitions</h3>
              <button className="btn primary" type="button" onClick={() => setShowFieldDefinitionForm((prev) => !prev)}>
                {showFieldDefinitionForm ? 'Close' : 'Create Field'}
              </button>
            </div>

            {showFieldDefinitionForm && (
              <form className="stack-form" onSubmit={onCreateFieldDefinition}>
                <label>
                  Field Name
                  <input value={fieldName} onChange={(e) => setFieldName(e.target.value)} required />
                </label>
                <label>
                  Field Type
                  <select
                    value={fieldType}
                    onChange={(e) => {
                      const nextType = e.target.value as 'text' | 'number' | 'date' | 'boolean'
                      setFieldType(nextType)
                      if (nextType !== 'number') {
                        setFieldAffectsBalance(false)
                        setFieldBalanceOperation('add')
                      }
                    }}
                  >
                    <option value="text">Text</option>
                    <option value="number">Number</option>
                    <option value="date">Date</option>
                    <option value="boolean">Boolean</option>
                  </select>
                </label>
                {fieldType === 'number' && (
                  <>
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={fieldAffectsBalance}
                        onChange={(e) => setFieldAffectsBalance(e.target.checked)}
                      />
                      <span>Use this field in balance calculation</span>
                    </label>
                    {fieldAffectsBalance && (
                      <label>
                        Balance Action
                        <select
                          value={fieldBalanceOperation}
                          onChange={(e) => setFieldBalanceOperation(e.target.value as 'add' | 'subtract')}
                        >
                          <option value="add">Add</option>
                          <option value="subtract">Subtract</option>
                        </select>
                      </label>
                    )}
                  </>
                )}
                <button className="btn primary" disabled={busy} type="submit">Save Field</button>
              </form>
            )}

            <div className="record-list">
              {fieldDefinitions.length === 0 && <p className="muted">No fields yet.</p>}
              {fieldDefinitions.map((field) => (
                <div key={field.id} className="record-main solo">
                  <strong>{field.field_name}</strong>
                  <small>Type: {field.field_type}</small>
                  <small>
                    Balance: {field.affects_balance ? field.balance_operation ?? 'None' : 'No'}
                  </small>
                  <small>Created: {new Date(field.created_at).toLocaleString()}</small>
                </div>
              ))}
            </div>
          </article>
        )}

        {activeTab === 'metal_receipt' && (
          <article className="mgmt-card">
            <div className="panel-head">
              <h3>Metal Receipt Records</h3>
              <button className="btn primary" type="button" onClick={() => setShowMetalReceiptForm((prev) => !prev)}>
                {showMetalReceiptForm ? 'Close' : 'Create Metal Receipt'}
              </button>
            </div>

            {showMetalReceiptForm && (
              <form className="stack-form" onSubmit={onCreateMetalReceipt}>
                <label>
                  Accounts
                  <input value={mrAccounts} onChange={(e) => setMrAccounts(e.target.value)} required />
                </label>
                <label>
                  Type
                  <input value={mrType} onChange={(e) => setMrType(e.target.value)} required />
                </label>
                <label>
                  Description
                  <input value={mrDescription} onChange={(e) => setMrDescription(e.target.value)} />
                </label>
                <label>
                  Melting Purity
                  <input type="number" step="0.0001" value={mrMeltingPurity} onChange={(e) => setMrMeltingPurity(e.target.value)} required />
                </label>
                <label>
                  In Weight
                  <input type="number" step="0.0001" value={mrInWeight} onChange={(e) => setMrInWeight(e.target.value)} required />
                </label>
                <button className="btn primary" disabled={busy} type="submit">Save Metal Receipt</button>
              </form>
            )}

            {metalReceipts.length === 0 && <p className="muted">No metal receipt records yet.</p>}
            {metalReceipts.length > 0 && (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Receipt No</th>
                      <th>Accounts</th>
                      <th>Type</th>
                      <th>Date</th>
                      <th>Description</th>
                      <th>Melting Purity</th>
                      <th>In Weight</th>
                      <th>Out Weight</th>
                      <th>Balance Weight</th>
                    </tr>
                  </thead>
                  <tbody>
                    {metalReceipts.map((record) => (
                      <tr key={record.id}>
                        <td>{record.receipt_no}</td>
                        <td>{record.accounts}</td>
                        <td>{record.type}</td>
                        <td>{new Date(record.date).toLocaleDateString()}</td>
                        <td>{record.description || '-'}</td>
                        <td>{record.melting_purity}</td>
                        <td>{record.in_weight}</td>
                        <td>{record.out_weight}</td>
                        <td>{record.balance_weight}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </article>
        )}

        {activeTab === 'purity' && (
          <article className="mgmt-card">
            <div className="panel-head">
              <h3>Purity Records</h3>
              <button className="btn primary" type="button" onClick={() => setShowPurityForm((prev) => !prev)}>
                {showPurityForm ? 'Close' : 'Create Purity'}
              </button>
            </div>

            {showPurityForm && (
              <form className="stack-form" onSubmit={onCreatePurity}>
                <label>
                  Purity Value
                  <input type="number" step="0.0001" value={purityValue} onChange={(e) => setPurityValue(e.target.value)} required />
                </label>
                <button className="btn primary" disabled={busy} type="submit">Save Purity</button>
              </form>
            )}

            <div className="record-list">
              {purities.length === 0 && <p className="muted">No purity records yet.</p>}
              {purities.map((purity) => (
                <div className="record-main solo" key={purity.id}>
                  <strong>Purity: {purity.purity_value}</strong>
                  <small>Date: {new Date(purity.date).toLocaleDateString()}</small>
                </div>
              ))}
            </div>
          </article>
        )}

        {activeTab === 'parent_lot' && (
          <article className="mgmt-card">
            <div className="panel-head">
              <h3>Parent Lot Records</h3>
              <button className="btn primary" type="button" onClick={() => setShowParentLotForm((prev) => !prev)}>
                {showParentLotForm ? 'Close' : 'Create Parent Lot'}
              </button>
            </div>

            {showParentLotForm && (
              <form className="stack-form" onSubmit={onCreateParentLot}>
                <label>
                  Product
                  <select value={parentLotProductId} onChange={(e) => setParentLotProductId(e.target.value)} required>
                    <option value="">Select product</option>
                    {products.map((product) => (
                      <option key={product.id} value={product.id}>{product.product_name}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Purity
                  <select value={parentLotPurityId} onChange={(e) => setParentLotPurityId(e.target.value)} required>
                    <option value="">Select purity</option>
                    {purities.map((purity) => (
                      <option key={purity.id} value={purity.id}>
                        {purity.purity_value} ({new Date(purity.date).toLocaleDateString()})
                      </option>
                    ))}
                  </select>
                </label>
                <button className="btn primary" disabled={busy} type="submit">Save Parent Lot</button>
              </form>
            )}

            {parentLots.length === 0 && <p className="muted">No parent lot records yet.</p>}
            {parentLots.length > 0 && (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Lot No</th>
                      <th>Product</th>
                      <th>Purity</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parentLots.map((lot) => {
                      const productLabel = products.find((product) => product.id === lot.product)?.product_name ?? `Product ${lot.product}`
                      const purityLabel = purities.find((purity) => purity.id === lot.purity)?.purity_value ?? lot.purity

                      return (
                        <tr key={lot.id}>
                          <td>{lot.name}</td>
                          <td>{productLabel}</td>
                          <td>{purityLabel}</td>
                          <td>{new Date(lot.date).toLocaleDateString()}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </article>
        )}

        {activeTab === 'melting_lot' && (
          <article className="mgmt-card">
            <div className="panel-head">
              <h3>Melting Lot Records</h3>
              <button className="btn primary" type="button" onClick={() => setShowMeltingLotForm((prev) => !prev)}>
                {showMeltingLotForm ? 'Close' : 'Create Melting Lot'}
              </button>
            </div>

            {showMeltingLotForm && (
              <form className="stack-form" onSubmit={onCreateMeltingLot}>
                <label>
                  Product
                  <select
                    value={meltingSelectedProducts[0] ?? ''}
                    onChange={(e) => setMeltingSelectedProducts(e.target.value ? [Number(e.target.value)] : [])}
                    required
                  >
                    <option value="">Select product</option>
                    {products.map((product) => (
                      <option key={product.id} value={product.id}>{product.product_name}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Parent Lot (optional)
                  <select
                    value={meltingSelectedParentLots[0] ?? ''}
                    onChange={(e) => setMeltingSelectedParentLots(e.target.value ? [Number(e.target.value)] : [])}
                  >
                    <option value="">Select parent lot</option>
                    {filteredParentLots.map((lot) => (
                      <option key={lot.id} value={lot.id}>{lot.name}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Purity
                  <select value={meltingPurityId} onChange={(e) => setMeltingPurityId(e.target.value)} required>
                    <option value="">Select purity</option>
                    {purities.map((purity) => (
                      <option key={purity.id} value={purity.id}>{purity.purity_value}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Description
                  <input value={meltingDescription} onChange={(e) => setMeltingDescription(e.target.value)} />
                </label>
                <label>
                  Hook Purity
                  <select value={meltingHookPurity} onChange={(e) => setMeltingHookPurity(e.target.value)} required>
                    <option value="">Select hook purity</option>
                    {purities.map((purity) => (
                      <option key={purity.id} value={purity.purity_value}>{purity.purity_value}</option>
                    ))}
                  </select>
                </label>
                <label>Metal Receipts</label>
                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Select</th>
                        <th>Receipt No</th>
                        <th>Accounts</th>
                        <th>Type</th>
                        <th>Date</th>
                        <th>Description</th>
                        <th>Melting Purity</th>
                        <th>Available Weight</th>
                        <th>Required Weight</th>
                        <th>Required Alloy Weight</th>
                      </tr>
                    </thead>
                    <tbody>
                      {metalReceiptReplicas.length === 0 && (
                        <tr>
                          <td colSpan={10}>No metal receipt records available.</td>
                        </tr>
                      )}
                      {metalReceiptReplicas.map((receipt) => (
                        <tr key={receipt.id}>
                          <td>
                            <input
                              type="checkbox"
                              checked={meltingSelectedMetalReceiptReplicaIds.includes(receipt.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setMeltingSelectedMetalReceiptReplicaIds((prev) => [...prev, receipt.id])
                                  return
                                }

                                setMeltingSelectedMetalReceiptReplicaIds((prev) => prev.filter((id) => id !== receipt.id))
                                setMeltingRequiredWeightsByReceipt((prev) => {
                                  const next = { ...prev }
                                  delete next[receipt.id]
                                  return next
                                })
                              }}
                            />
                          </td>
                          <td>{receipt.receipt_no}</td>
                          <td>{receipt.accounts}</td>
                          <td>{receipt.type}</td>
                          <td>{new Date(receipt.date).toLocaleDateString()}</td>
                          <td>{receipt.description || '-'}</td>
                          <td>{receipt.melting_purity}</td>
                          <td>{receipt.in_weight}</td>
                          <td>
                            {meltingSelectedMetalReceiptReplicaIds.includes(receipt.id) ? (
                              <input
                                type="number"
                                step="0.0001"
                                min="0"
                                value={meltingRequiredWeightsByReceipt[receipt.id] ?? ''}
                                onChange={(e) =>
                                  setMeltingRequiredWeightsByReceipt((prev) => ({
                                    ...prev,
                                    [receipt.id]: e.target.value,
                                  }))
                                }
                                required
                              />
                            ) : (
                              '-'
                            )}
                          </td>
                          <td>
                            {meltingSelectedMetalReceiptReplicaIds.includes(receipt.id)
                              ? (meltingReceiptPreviews[receipt.id]
                                  ? formatWeight(meltingReceiptPreviews[receipt.id]!.requiredAlloyWeight)
                                  : '-')
                              : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="melting-summary-cards">
                  <article className="melting-summary-card">
                    <small>Gross Weight</small>
                    <strong>{formatWeight(meltingReceiptTotals.grossWeight)}</strong>
                  </article>
                  <article className="melting-summary-card">
                    <small>Total Required Weight</small>
                    <strong>{formatWeight(meltingReceiptTotals.requiredWeight)}</strong>
                  </article>
                  <article className="melting-summary-card">
                    <small>Total Required Alloy Weight</small>
                    <strong>{formatWeight(meltingReceiptTotals.requiredAlloyWeight)}</strong>
                  </article>
                </div>
                <button className="btn primary" disabled={busy || meltingSelectedMetalReceiptReplicaIds.length === 0 || meltingSelectedProducts.length === 0} type="submit">
                  Save Melting Lot
                </button>
              </form>
            )}

            {meltingLots.length === 0 && <p className="muted">No melting lot records yet.</p>}
            {meltingLots.length > 0 && (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Open</th>
                      <th>Lot No(name)</th>
                      <th>Date</th>
                      <th>Product</th>
                      <th>Description</th>
                      <th>Required_weight</th>
                      <th>required_Alloy Weight</th>
                      <th>Gross Weight</th>
                      <th>Purity (%)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {meltingLots.map((lot) => {
                      const productNames = lot.products
                        .map((id) => products.find((product) => product.id === id)?.product_name ?? `Product ${id}`)
                        .join(', ')
                      const purityLabel = purities.find((purity) => purity.id === lot.purity)?.purity_value ?? '-'
                      const grossWeight = lot.gross_weight

                      return (
                        <tr key={lot.id}>
                          <td>
                            <button
                              className="btn"
                              type="button"
                              onClick={() => window.open(`/mgmt/melting-lot/${lot.id}`, '_blank', 'noopener,noreferrer')}
                            >
                              View
                            </button>
                          </td>
                          <td>{lot.name}</td>
                          <td>{new Date(lot.date).toLocaleDateString()}</td>
                          <td>{productNames}</td>
                          <td>{lot.description || '-'}</td>
                          <td>{formatWeight(lot.required_weight)}</td>
                          <td>{formatWeight(lot.require_alloy_weight)}</td>
                          <td>{formatWeight(grossWeight)}</td>
                          <td>{typeof purityLabel === 'number' ? purityLabel.toFixed(3) : purityLabel}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </article>
        )}
      </div>
    </section>
  )
}

function DepartmentRecordDetailPage() {
  const navigate = useNavigate()
  const { recordId, draftKey } = useParams()
  const [record, setRecord] = useState<DepartmentRecord | null>(null)
  const [draftContext, setDraftContext] = useState<DepartmentRecordDraftContext | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [activeFieldName, setActiveFieldName] = useState<string | null>(null)
  const [activeFieldValue, setActiveFieldValue] = useState('')
  const [outWeight, setOutWeight] = useState('')
  const [tounch, setTounch] = useState('')
  const [tounchPurity, setTounchPurity] = useState('')
  const [fieldValues, setFieldValues] = useState<Record<string, FieldValue>>({})

  useEffect(() => {
    setLoading(true)
    setError('')

    if (recordId) {
      const parsedRecordId = Number(recordId)
      if (Number.isNaN(parsedRecordId) || parsedRecordId <= 0) {
        setError('Invalid department record.')
        setLoading(false)
        return
      }

      fetchDepartmentRecord(parsedRecordId)
        .then((payload) => {
          setRecord(payload)
          setDraftContext(null)
        })
        .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load department record'))
        .finally(() => setLoading(false))
      return
    }

    if (draftKey) {
      const savedDraft = localStorage.getItem(`${DEPARTMENT_RECORD_DRAFT_STORAGE_KEY}:${draftKey}`)
      if (!savedDraft) {
        setError('Draft department record not found.')
        setLoading(false)
        return
      }

      try {
        const payload = JSON.parse(savedDraft) as DepartmentRecordDraftContext
        setDraftContext(payload)
        setRecord(null)
      } catch {
        setError('Failed to load draft department record.')
      } finally {
        setLoading(false)
      }
      return
    }

    setError('Invalid department record.')
    setLoading(false)
  }, [draftKey, recordId])

  useEffect(() => {
    const source = record ?? draftContext
    if (!source) {
      return
    }

    setOutWeight(record ? '' : String(source.out_weight))
    setTounch(String(source.tounch))
    setTounchPurity(String(source.tounch_purity))
    setFieldValues(source.field_values)
  }, [draftContext, record?.id])

  if (loading) {
    return (
      <section className="mgmt-card">
        <p>Loading department record...</p>
      </section>
    )
  }

  if (error || (!record && !draftContext)) {
    return (
      <section className="mgmt-card">
        <div className="panel-head">
          <h3>Department Record</h3>
          <button className="btn" type="button" onClick={() => navigate('/mgmt')}>Back</button>
        </div>
        <p className="error">{error || 'Department record not found.'}</p>
      </section>
    )
  }

  const currentRecord = record ?? draftContext
  if (!currentRecord) {
    return null
  }
  const currentRecordData = currentRecord
  const receiptRows = currentRecordData.receipt_rows.length > 0
    ? currentRecordData.receipt_rows
    : [
        {
          receipt_no: currentRecordData.receipt_no,
          accounts: currentRecordData.receipt_accounts,
          type: currentRecordData.receipt_type,
          date: currentRecordData.receipt_date,
          description: currentRecordData.receipt_description,
          melting_purity: currentRecordData.metal_receipt_purity,
          in_weight: currentRecordData.receipt_in_weight,
          balance_weight: currentRecordData.receipt_balance_weight,
          required_weight: 0,
          require_alloy_weight: 0,
        },
      ].filter((receipt) => receipt.receipt_no || receipt.accounts)

  const parsedOutWeight = outWeight === '' ? 0 : Number(outWeight)
  const parsedTounch = tounch === '' ? 0 : Number(tounch)
  const parsedTounchPurity = tounchPurity === '' ? 0 : Number(tounchPurity)
  const effectiveOutWeight = record ? record.out_weight + parsedOutWeight : parsedOutWeight
  const fieldBalanceAdjustment = calculateFieldBalanceAdjustment(
    currentRecordData.department_fields,
    Object.fromEntries(
      Object.entries(fieldValues).map(([key, value]) => [key, value === null || value === undefined ? '' : String(value)]),
    ),
  )
  const previewMetrics =
    !Number.isNaN(parsedOutWeight) && !Number.isNaN(parsedTounch)
      ? calculateDepartmentBalances(
          currentRecordData.in_weight,
          effectiveOutWeight,
          parsedTounch,
          fieldBalanceAdjustment,
          currentRecordData.metal_receipt_purity,
          currentRecordData.lot_purity,
        )
      : null

  const parentLotLabel = currentRecordData.parent_lot_names.length > 0 ? currentRecordData.parent_lot_names.join(', ') : '--'
  const outHistoryRows = currentRecordData.transfer_batches ?? []
  const activeField = currentRecordData.department_fields.find((field) => field.field_name === activeFieldName) ?? null
  const recordFieldEntries = currentRecordData.department_fields.map((field) => ({
    ...field,
    value: fieldValues[field.field_name] ?? '',
  }))

  function onApplyFieldValue() {
    if (!activeField) {
      return
    }

    setFieldValues((prev) => ({
      ...prev,
        [activeField.field_name]:
          activeField.field_type === 'number'
            ? activeFieldValue
            : activeField.field_type === 'boolean'
              ? activeFieldValue === 'true'
              : activeFieldValue,
    }))
    setActiveFieldName(null)
    setActiveFieldValue('')
  }

  async function onSaveRecord() {
    if (Number.isNaN(parsedOutWeight) || parsedOutWeight < 0) {
      setError('OUT weight must be a valid non-negative number.')
      return
    }
    if (Number.isNaN(parsedTounch) || parsedTounch < 0) {
      setError('Tounch must be a valid non-negative number.')
      return
    }
    if (tounchPurity === '' || Number.isNaN(parsedTounchPurity) || parsedTounchPurity < 0) {
      setError('Tounch purity must be a valid non-negative number.')
      return
    }
    if (effectiveOutWeight + parsedTounch > currentRecordData.in_weight) {
      setError('Not possible')
      return
    }

    setSaving(true)
    setError('')

    try {
      const payload = {
        department: currentRecordData.department,
        melting_lot: currentRecordData.melting_lot,
        source_record: currentRecordData.source_record ?? undefined,
        source_batch: currentRecordData.source_batch ?? undefined,
        input_weight_override: currentRecordData.source_record ? currentRecordData.in_weight : undefined,
        out_weight: effectiveOutWeight,
        tounch: parsedTounch,
        tounch_purity: parsedTounchPurity,
        field_values: buildDepartmentFieldPayload(
          Object.fromEntries(
            Object.entries(fieldValues).map(([key, value]) => [key, value === null || value === undefined ? '' : String(value)]),
          ),
          currentRecordData.department_fields,
        ),
        is_active: true,
      }

      const savedRecord = record
        ? await updateDepartmentRecord(record.id, payload)
        : await createDepartmentRecord(payload)

      setRecord(savedRecord)
      setDraftContext(null)
      setOutWeight('')
      setTounch('0')
      setTounchPurity('0')
      setFieldValues({})
      setActiveFieldName(null)
      setActiveFieldValue('')
      localStorage.setItem(DEPARTMENT_RECORD_UPDATE_SIGNAL_KEY, String(Date.now()))
      if (draftKey) {
        localStorage.removeItem(`${DEPARTMENT_RECORD_DRAFT_STORAGE_KEY}:${draftKey}`)
        navigate(`/mgmt/department-record/${savedRecord.id}`, { replace: true })
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save department record')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="record-detail-page">
      <article className="mgmt-card record-detail-shell">
        <div className="panel-head record-detail-header">
          <div className="record-detail-title">
            <p className="eyebrow">Department Record</p>
            <h3>{`${currentRecordData.lot_no}-${currentRecordData.department_name}${record ? `-${record.id}` : '-Draft'}`}</h3>
          </div>
          <div className="cta-row">
            <button className="btn primary" disabled={saving} type="button" onClick={onSaveRecord}>
              {saving ? 'Saving...' : 'Save Record'}
            </button>
            <button className="btn" type="button" onClick={() => window.close()}>Close</button>
            <button className="btn primary" type="button" onClick={() => navigate('/mgmt')}>Back</button>
          </div>
        </div>

        <div className="record-detail-top">
          <section className="record-detail-card">
            <div className="record-detail-metrics">
              <div>
                <strong>{currentRecordData.product_name}</strong>
                <small>Product</small>
              </div>
              <div>
                <strong>{currentRecordData.process_name}</strong>
                <small>Process</small>
              </div>
              <div>
                <strong>{currentRecordData.department_name}</strong>
                <small>Department</small>
              </div>
            </div>
          </section>

          <section className="record-detail-card">
            <div className="record-detail-metrics">
              <div>
                <strong>{currentRecordData.lot_no}</strong>
                <small>Melting Lot</small>
              </div>
              <div>
                <strong>{parentLotLabel}</strong>
                <small>Parent Lot</small>
              </div>
              <div>
                <strong>{currentRecordData.lot_purity.toFixed(3)}</strong>
                <small>Melting Lot Purity</small>
              </div>
            </div>
          </section>

          <section className="record-detail-card">
            <div className="record-detail-metrics">
              <div>
                <strong>{previewMetrics ? previewMetrics.balance.toFixed(3) : '--'}</strong>
                <small>Balance</small>
              </div>
              <div>
                <strong>{previewMetrics ? previewMetrics.balanceGross.toFixed(3) : '--'}</strong>
                <small>Gross Balance</small>
              </div>
              <div>
                <strong>{previewMetrics ? previewMetrics.balanceFine.toFixed(3) : '--'}</strong>
                <small>Fine Balance</small>
              </div>
            </div>
          </section>
        </div>

        <div className="record-detail-bottom">
          <div className="record-detail-stack">
            <section className="record-detail-card">
              <div className="panel-head">
                <h3>Receipt</h3>
              </div>
              <div className="table-wrap">
                <table className="data-table record-detail-table">
                  <thead>
                    <tr>
                      <th>Receipt No</th>
                      <th>Accounts</th>
                      <th>Type</th>
                      <th>Date</th>
                      <th>Description</th>
                      <th>Melting Purity</th>
                      <th>In Weight</th>
                      <th>Balance Weight</th>
                      <th>Required Weight</th>
                      <th>Required Alloy Weight</th>
                    </tr>
                  </thead>
                  <tbody>
                    {receiptRows.length === 0 && (
                      <tr>
                        <td colSpan={10}>No receipt records linked to this melting lot.</td>
                      </tr>
                    )}
                    {receiptRows.map((receiptRow, index) => (
                      <tr key={`${receiptRow.receipt_no ?? 'receipt'}-${index}`}>
                        <td>{receiptRow.receipt_no ?? '--'}</td>
                        <td>{receiptRow.accounts ?? '--'}</td>
                        <td>{receiptRow.type ?? '--'}</td>
                        <td>{receiptRow.date ? new Date(receiptRow.date).toLocaleDateString() : '--'}</td>
                        <td>{receiptRow.description || '--'}</td>
                        <td>{receiptRow.melting_purity.toFixed(3)}</td>
                        <td>{receiptRow.in_weight ?? '--'}</td>
                        <td>{receiptRow.balance_weight ?? '--'}</td>
                        <td>{receiptRow.required_weight ? formatWeight(receiptRow.required_weight) : '--'}</td>
                        <td>{receiptRow.require_alloy_weight ? formatWeight(receiptRow.require_alloy_weight) : '--'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="record-detail-card">
              <div className="panel-head">
                <h3>OUT Records</h3>
              </div>
              <div className="table-wrap">
                <table className="data-table record-detail-table">
                  <thead>
                    <tr>
                      <th>Record No</th>
                      <th>Lot No</th>
                      <th>Lot Purity</th>
                      <th>IN</th>
                      <th>OUT Weight</th>
                      <th>Total OUT After Save</th>
                      <th>Tounch Number</th>
                      <th>Tounch</th>
                      <th>Tounch Purity</th>
                      <th>Balance</th>
                      <th>Balance Gross</th>
                      <th>Balance Fine</th>
                      {currentRecordData.department_fields.map((field) => (
                        <th key={field.id}>{field.field_name}</th>
                      ))}
                      <th>Saved At</th>
                    </tr>
                  </thead>
                  <tbody>
                    {outHistoryRows.length === 0 && (
                      <tr>
                        <td colSpan={13 + currentRecordData.department_fields.length}>No saved OUT records yet.</td>
                      </tr>
                    )}
                    {outHistoryRows.map((batch, index) => (
                      <tr key={batch.id}>
                        <td>{index + 1}</td>
                        <td>{batch.lot_no ?? currentRecordData.lot_no}</td>
                        <td>{batch.lot_purity !== undefined && batch.lot_purity !== null ? batch.lot_purity.toFixed(3) : '--'}</td>
                        <td>{batch.input_weight !== undefined && batch.input_weight !== null ? formatWeight(batch.input_weight) : '--'}</td>
                        <td>{formatWeight(batch.forwarded_weight)}</td>
                        <td>{batch.total_out_weight !== undefined && batch.total_out_weight !== null ? formatWeight(batch.total_out_weight) : '--'}</td>
                        <td>{batch.tounch_number ?? '--'}</td>
                        <td>{batch.tounch !== undefined && batch.tounch !== null ? formatWeight(batch.tounch) : '--'}</td>
                        <td>{batch.tounch_purity !== undefined && batch.tounch_purity !== null ? formatWeight(batch.tounch_purity) : '--'}</td>
                        <td>{batch.balance !== undefined && batch.balance !== null ? formatWeight(batch.balance) : '--'}</td>
                        <td>{batch.balance_gross !== undefined && batch.balance_gross !== null ? formatWeight(batch.balance_gross) : '--'}</td>
                        <td>{batch.balance_fine !== undefined && batch.balance_fine !== null ? formatWeight(batch.balance_fine) : '--'}</td>
                        {currentRecordData.department_fields.map((field) => {
                          const value = batch.field_values?.[field.field_name]
                          return <td key={`${batch.id}-${field.id}`}>{value === undefined || value === '' ? '--' : String(value)}</td>
                        })}
                        <td>{batch.saved_at ? new Date(batch.saved_at).toLocaleString() : '--'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>

          <section className="record-detail-card">
            <div className="panel-head">
              <h3>Fields</h3>
            </div>
            <div className="record-field-editor record-mandatory-editor">
              <div className="record-mandatory-grid">
                <label>
                  {record ? 'Additional OUT Weight' : 'OUT Weight'}
                  <input type="number" step="0.0001" min="0" value={outWeight} onChange={(e) => setOutWeight(e.target.value)} />
                  {record && <small>Current OUT: {record.out_weight}</small>}
                </label>
                <label>
                  Tounch
                  <input type="number" step="0.0001" min="0" value={tounch} onChange={(e) => setTounch(e.target.value)} />
                </label>
                <label>
                  Tounch Purity
                  <input type="number" step="0.0001" min="0" value={tounchPurity} onChange={(e) => setTounchPurity(e.target.value)} />
                </label>
              </div>
            </div>
            <div className="record-field-buttons">
              {currentRecordData.department_fields.length === 0 && <p className="muted">No fields configured.</p>}
              {currentRecordData.department_fields.map((field) => (
                <button
                  key={field.id}
                  className={activeFieldName === field.field_name ? 'btn primary' : 'btn'}
                  type="button"
                  onClick={() => {
                    setActiveFieldName(field.field_name)
                    const currentValue = fieldValues[field.field_name]
                    setActiveFieldValue(
                      currentValue === undefined || currentValue === null ? '' : String(currentValue),
                    )
                  }}
                >
                  {field.field_name}
                </button>
              ))}
            </div>
            {activeField && (
              <div className="record-field-editor">
                <label>
                  {activeField.field_name}
                  {activeField.field_type === 'boolean' ? (
                    <select value={activeFieldValue} onChange={(e) => setActiveFieldValue(e.target.value)}>
                      <option value="">Select value</option>
                      <option value="true">True</option>
                      <option value="false">False</option>
                    </select>
                  ) : (
                    <input
                      type={activeField.field_type === 'number' ? 'number' : activeField.field_type === 'date' ? 'date' : 'text'}
                      step={activeField.field_type === 'number' ? '0.0001' : undefined}
                      value={activeFieldValue}
                      onChange={(e) => setActiveFieldValue(e.target.value)}
                    />
                  )}
                </label>
                <div className="cta-row">
                  <button className="btn" type="button" onClick={() => {
                    setActiveFieldName(null)
                    setActiveFieldValue('')
                  }}>
                    Cancel
                  </button>
                  <button className="btn primary" type="button" onClick={onApplyFieldValue}>
                    Apply
                  </button>
                </div>
              </div>
            )}
            <div className="record-field-values">
              {recordFieldEntries.length === 0 && <p className="muted">No data found.</p>}
              {recordFieldEntries.map((field) => (
                <div key={field.id} className="record-main solo">
                  <strong>{field.field_name}</strong>
                  <small>Type: {field.field_type}</small>
                  <small>Value: {field.value === '' ? '--' : String(field.value)}</small>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="record-detail-footer">
          <p className="muted">Created on: {record ? new Date(record.created_at).toLocaleString() : '--'}</p>
          <p className="muted">Created by: {record ? record.created_by_username : '--'}</p>
          <p className="muted">Modified on: {record ? new Date(record.updated_at).toLocaleString() : '--'}</p>
        </div>
      </article>
    </section>
  )
}

function MeltingLotDetailPage() {
  const navigate = useNavigate()
  const { lotId } = useParams()
  const [lot, setLot] = useState<MeltingLot | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [purities, setPurities] = useState<Purity[]>([])
  const [parentLots, setParentLots] = useState<ParentLot[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const parsedLotId = Number(lotId)
    if (Number.isNaN(parsedLotId) || parsedLotId <= 0) {
      setError('Invalid melting lot.')
      setLoading(false)
      return
    }

    setLoading(true)
    setError('')

    Promise.all([
      fetchMeltingLot(parsedLotId),
      fetchProducts(),
      fetchPurities(),
      fetchParentLots(),
    ])
      .then(([lotPayload, productList, purityList, parentLotList]) => {
        setLot(lotPayload)
        setProducts(productList)
        setPurities(purityList)
        setParentLots(parentLotList)
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load melting lot'))
      .finally(() => setLoading(false))
  }, [lotId])

  if (loading) {
    return (
      <section className="mgmt-card">
        <p>Loading melting lot...</p>
      </section>
    )
  }

  if (error || !lot) {
    return (
      <section className="mgmt-card">
        <div className="panel-head">
          <h3>Melting Lot</h3>
          <button className="btn" type="button" onClick={() => navigate('/mgmt')}>Back</button>
        </div>
        <p className="error">{error || 'Melting lot not found.'}</p>
      </section>
    )
  }

  const productNames = lot.products
    .map((id) => products.find((product) => product.id === id)?.product_name ?? `Product ${id}`)
    .join(', ')
  const purityLabel = purities.find((purity) => purity.id === lot.purity)?.purity_value ?? lot.purity
  const parentLotNames = parentLots
    .filter((parentLot) => lot.parent_lots.includes(parentLot.id))
    .map((parentLot) => parentLot.name)
    .join(', ') || '--'

  return (
    <section className="record-detail-page">
      <article className="mgmt-card record-detail-shell">
        <div className="panel-head record-detail-header">
          <div className="record-detail-title">
            <p className="eyebrow">Melting Lot</p>
            <h3>{lot.name}</h3>
          </div>
          <div className="cta-row">
            <button className="btn" type="button" onClick={() => window.close()}>Close</button>
            <button className="btn primary" type="button" onClick={() => navigate('/mgmt')}>Back</button>
          </div>
        </div>

        <div className="record-detail-top">
          <section className="record-detail-card">
            <div className="record-detail-metrics">
              <div>
                <strong>{productNames || '--'}</strong>
                <small>Product</small>
              </div>
              <div>
                <strong>{parentLotNames}</strong>
                <small>Parent Lot</small>
              </div>
              <div>
                <strong>{new Date(lot.date).toLocaleDateString()}</strong>
                <small>Date</small>
              </div>
            </div>
          </section>

          <section className="record-detail-card">
            <div className="record-detail-metrics">
              <div>
                <strong>{Number(purityLabel).toFixed(3)}</strong>
                <small>Purity</small>
              </div>
              <div>
                <strong>{formatWeight(lot.required_weight)}</strong>
                <small>Required Weight</small>
              </div>
              <div>
                <strong>{formatWeight(lot.require_alloy_weight)}</strong>
                <small>Required Alloy Weight</small>
              </div>
            </div>
          </section>

          <section className="record-detail-card">
            <div className="record-detail-metrics">
              <div>
                <strong>{formatWeight(lot.gross_weight)}</strong>
                <small>Gross Weight</small>
              </div>
              <div>
                <strong>{lot.hook_purity.toFixed(3)}</strong>
                <small>Hook Purity</small>
              </div>
              <div>
                <strong>{lot.description || '--'}</strong>
                <small>Description</small>
              </div>
            </div>
          </section>
        </div>

        <div className="record-detail-bottom melting-detail-bottom">
          <section className="record-detail-card">
            <div className="panel-head">
              <h3>Receipt Records</h3>
            </div>
            <div className="table-wrap">
              <table className="data-table record-detail-table">
                <thead>
                  <tr>
                    <th>Receipt No</th>
                    <th>Accounts</th>
                    <th>Type</th>
                    <th>Date</th>
                    <th>Description</th>
                    <th>Melting Purity</th>
                    <th>In Weight</th>
                    <th>Balance Weight</th>
                    <th>Required Weight</th>
                    <th>Required Alloy Weight</th>
                  </tr>
                </thead>
                <tbody>
                  {lot.receipt_allocation_details.length === 0 && (
                    <tr>
                      <td colSpan={10}>No receipt records linked to this melting lot.</td>
                    </tr>
                  )}
                  {lot.receipt_allocation_details.map((receiptRow, index) => (
                    <tr key={`${receiptRow.receipt_no ?? 'receipt'}-${index}`}>
                      <td>{receiptRow.receipt_no ?? '--'}</td>
                      <td>{receiptRow.accounts ?? '--'}</td>
                      <td>{receiptRow.type ?? '--'}</td>
                      <td>{receiptRow.date ? new Date(receiptRow.date).toLocaleDateString() : '--'}</td>
                      <td>{receiptRow.description || '--'}</td>
                      <td>{receiptRow.melting_purity.toFixed(3)}</td>
                      <td>{receiptRow.in_weight ?? '--'}</td>
                      <td>{receiptRow.balance_weight ?? '--'}</td>
                      <td>{formatWeight(receiptRow.required_weight)}</td>
                      <td>{formatWeight(receiptRow.require_alloy_weight)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </article>
    </section>
  )
}

function ProtectedMgmtRoute() {
  if (!getAccessToken()) {
    return <Navigate to="/auth" replace />
  }

  return <MgmtPage />
}

function ProtectedDepartmentRecordRoute() {
  if (!getAccessToken()) {
    return <Navigate to="/auth" replace />
  }

  return <DepartmentRecordDetailPage />
}

function ProtectedDepartmentRecordDraftRoute() {
  if (!getAccessToken()) {
    return <Navigate to="/auth" replace />
  }

  return <DepartmentRecordDetailPage />
}

function ProtectedMeltingLotRoute() {
  if (!getAccessToken()) {
    return <Navigate to="/auth" replace />
  }

  return <MeltingLotDetailPage />
}

export default function App() {
  return (
    <main className="app-shell">
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/mgmt" element={<ProtectedMgmtRoute />} />
        <Route path="/mgmt/melting-lot/:lotId" element={<ProtectedMeltingLotRoute />} />
        <Route path="/mgmt/department-record/:recordId" element={<ProtectedDepartmentRecordRoute />} />
        <Route path="/mgmt/department-record-draft/:draftKey" element={<ProtectedDepartmentRecordDraftRoute />} />
      </Routes>
    </main>
  )
}
