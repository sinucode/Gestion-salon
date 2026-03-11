'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DollarSign, Loader2, TrendingUp, TrendingDown, Wallet, ArrowRightLeft, Lock, Unlock, Banknote, FileText, Printer, ShieldCheck, History, MapPin, AlertTriangle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores'
import { format_currency } from '@/lib/utils/currency'
import { toast } from 'sonner'
import { open_cash_register, close_cash_register, transfer_funds, process_payout, create_expense, get_z_report_details } from '@/actions/finance'

export default function FinanceERPPage() {
    const { user, selectedBusinessId, selectedLocationIds, timezone } = useAuthStore()
    const isSuperAdmin = user?.role === 'super_admin'
    const isAdmin = user?.role === 'admin'
    const filterBusinessId = isSuperAdmin ? selectedBusinessId : user?.business_id

    const [loading, setLoading] = useState(true)
    const [activeTab, setActiveTab] = useState('pnl')

    // Filters for P&L
    const defaultStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]
    const defaultEnd = new Date().toISOString().split('T')[0]
    const [startDate, setStartDate] = useState(defaultStart)
    const [endDate, setEndDate] = useState(defaultEnd)
    const [locationsList, setLocationsList] = useState<any[]>([])

    // Data states
    const [pnl, setPnl] = useState<any[]>([])
    const [accounts, setAccounts] = useState<any[]>([])
    const [registers, setRegisters] = useState<any[]>([])
    const [professionals, setProfessionals] = useState<any[]>([])
    const [payouts, setPayouts] = useState<any[]>([])
    const [expenses, setExpenses] = useState<any[]>([])
    const [movements, setMovements] = useState<any[]>([])

    // Dialog states
    const [openTransfer, setOpenTransfer] = useState(false)
    const [openRegister, setOpenRegister] = useState(false)
    const [openCloseReg, setOpenCloseReg] = useState(false)
    const [openPayout, setOpenPayout] = useState(false)
    const [openExpense, setOpenExpense] = useState(false)

    // Form states
    const [formTransfer, setFormTransfer] = useState({ from: '', to: '', amount: 0, desc: '' })
    const [formClose, setFormClose] = useState({ amount: 0, notes: '' })
    const [formPayout, setFormPayout] = useState({ prof_id: '', account_id: '', amount: 0 })
    const [formExpense, setFormExpense] = useState({ category: '', account_id: '', amount: 0, description: '' })
    
    // Multi-account declarations (opening & closing)
    const [declarations, setDeclarations] = useState<any[]>([])
    const [closingDeclarations, setClosingDeclarations] = useState<any[]>([])

    const [activeRegId, setActiveRegId] = useState<string | null>(null)
    const [activeLocId, setActiveLocId] = useState<string | null>(null)

    const isGlobalView = selectedLocationIds.length !== 1 || !activeLocId
    const activeLocationName = locationsList.find(l => l.id === activeLocId)?.name || 'Desconocida'

    // Printing state
    const [receiptData, setReceiptData] = useState<any>(null)
    const [isPrinting, setIsPrinting] = useState(false)

    const fetchData = async () => {
        if (!filterBusinessId) { setLoading(false); return }
        const supabase = createClient()
        
        let availableLocs = locationsList
        if ((isSuperAdmin || isAdmin) && locationsList.length === 0) {
            const { data: locs } = await supabase.from('locations').select('id, name').eq('business_id', filterBusinessId)
            if (locs) {
                // Admin multi-sede filtering: only show assigned locations
                let filteredLocs = locs
                if (isAdmin && !isSuperAdmin) {
                    const { data: myProfile } = await supabase.from('profiles').select('location_id, assigned_locations').eq('id', user!.id).single()
                    if (myProfile) {
                        const allowed = new Set<string>()
                        if (myProfile.location_id) allowed.add(myProfile.location_id)
                        if (myProfile.assigned_locations) myProfile.assigned_locations.forEach((lid: string) => allowed.add(lid))
                        filteredLocs = locs.filter(l => allowed.has(l.id))
                    }
                }
                setLocationsList(filteredLocs)
                availableLocs = filteredLocs
            }
        }

        // Determine what to query contextually
        let queryLocs = selectedLocationIds.length > 0 ? selectedLocationIds : availableLocs.map(l => l.id)
        
        // Active location for operational buttons (transfer, payout)
        if (selectedLocationIds.length === 1) {
            setActiveLocId(selectedLocationIds[0])
        } else {
            setActiveLocId(null)
        }

        // Setup queries dynamically
        let pnlQuery = supabase.from('v_pnl').select('*').eq('business_id', filterBusinessId)
        if (queryLocs.length > 0) pnlQuery = pnlQuery.in('location_id', queryLocs)
        if (startDate) pnlQuery = pnlQuery.gte('date', startDate)
        if (endDate) pnlQuery = pnlQuery.lte('date', endDate)

        let accQuery = supabase.from('accounts').select('*').eq('business_id', filterBusinessId).eq('is_active', true)
        if (queryLocs.length > 0) accQuery = accQuery.in('location_id', queryLocs)

        let regQuery = supabase.from('v_cash_registers_summary').select('*').eq('business_id', filterBusinessId).order('opened_at', { ascending: false }).limit(20)
        if (queryLocs.length > 0) regQuery = regQuery.in('location_id', queryLocs)

        let profQuery = supabase.from('v_professional_earnings').select('*, profile:profiles!v_professional_earnings_professional_id_fkey(first_name, last_name)')
        if (queryLocs.length > 0) profQuery = profQuery.in('location_id', queryLocs)

        let payQuery = supabase.from('payouts').select('*, profile:profiles!payouts_professional_id_fkey(first_name)').eq('business_id', filterBusinessId).order('created_at', { ascending: false }).limit(20)
        if (queryLocs.length > 0) payQuery = payQuery.in('location_id', queryLocs)

        let expQuery = supabase.from('operating_expenses').select('*, creator:profiles!operating_expenses_created_by_fkey(first_name), account:accounts!operating_expenses_account_id_fkey(name)').eq('business_id', filterBusinessId).order('created_at', { ascending: false }).limit(20)
        if (queryLocs.length > 0) expQuery = expQuery.in('location_id', queryLocs)

        let movQuery = supabase.from('cash_movements').select('*, creator:profiles!cash_movements_created_by_fkey(first_name), account:accounts(name)').eq('business_id', filterBusinessId).order('created_at', { ascending: false }).limit(100)
        if (queryLocs.length > 0) movQuery = movQuery.in('location_id', queryLocs)

        const [
            { data: resPnl },
            { data: resAcc },
            { data: resReg },
            { data: resProf },
            { data: resPay },
            { data: resExp },
            { data: resMov }
        ] = await Promise.all([
            pnlQuery, accQuery, regQuery, profQuery, payQuery, expQuery, movQuery
        ])

        if (resPnl) setPnl(resPnl)
        if (resAcc) setAccounts(resAcc)
        if (resReg) {
            setRegisters(resReg)
            const open = resReg.find(r => r.status === 'open')
            setActiveRegId(open ? open.id : null)
        }
        if (resProf) setProfessionals(resProf)
        if (resPay) setPayouts(resPay)
        if (resExp) setExpenses(resExp)
        if (resMov) setMovements(resMov)

        setLoading(false)
    }

    useEffect(() => { setLoading(true); fetchData() }, [filterBusinessId, startDate, endDate, selectedLocationIds])

    const handleTransfer = async () => {
        if (isGlobalView) return toast.error('Debes seleccionar una sede física específica.')
        if (!activeRegId || !activeLocId) return toast.error('Debes abrir caja para transferir.')
        try {
            await transfer_funds({
                business_id: filterBusinessId!, location_id: activeLocId,
                cash_register_id: activeRegId,
                from_account_id: formTransfer.from, to_account_id: formTransfer.to,
                amount: formTransfer.amount, description: formTransfer.desc
            })
            toast.success('Suma Cero completada')
            setOpenTransfer(false)
            fetchData()
        } catch(e:any) { toast.error(e.message) }
    }

    const initOpenRegister = () => {
        const initialDecs = accounts.map(acc => ({
            account_id: acc.id,
            name: acc.name,
            expected: acc.balance,
            real: acc.balance, // Pre-filled with expected
            difference: 0,
            justification: ''
        }))
        setDeclarations(initialDecs)
        setOpenRegister(true)
    }

    const updateDeclaration = (idx: number, realValue: number) => {
        const newDecs = [...declarations]
        const d = newDecs[idx]
        d.real = realValue
        d.difference = d.real - d.expected
        setDeclarations(newDecs)
    }

    const updateJustification = (idx: number, text: string) => {
        const newDecs = [...declarations]
        newDecs[idx].justification = text
        setDeclarations(newDecs)
    }

    const handleOpenReg = async () => {
        if (isGlobalView || !activeLocId) return toast.error('Debes seleccionar una sede física específica.')
        
        // Validation: If difference != 0, justification is mandatory
        const invalid = declarations.find(d => d.difference !== 0 && !d.justification.trim())
        if (invalid) return toast.error(`Justifica la diferencia en la cuenta: ${invalid.name}`)

        try {
            await open_cash_register({ 
                business_id: filterBusinessId!, 
                location_id: activeLocId, 
                declarations: declarations.map(d => ({
                    account_id: d.account_id,
                    expected: d.expected,
                    real: d.real,
                    difference: d.difference,
                    justification: d.justification
                })) 
            })
            toast.success('Caja Abierta y Arqueo Sincronizado')
            setOpenRegister(false)
            fetchData()
        } catch(e:any) { toast.error(e.message) }
    }

    const initCloseRegister = () => {
        const closeDecs = accounts.map(acc => ({
            account_id: acc.id,
            name: acc.name,
            expected: acc.balance,
            real: acc.balance,
            difference: 0,
            justification: ''
        }))
        setClosingDeclarations(closeDecs)
        setOpenCloseReg(true)
    }

    const updateClosingDeclaration = (idx: number, realValue: number) => {
        const newDecs = [...closingDeclarations]
        const d = newDecs[idx]
        d.real = realValue
        d.difference = d.real - d.expected
        setClosingDeclarations(newDecs)
    }

    const updateClosingJustification = (idx: number, text: string) => {
        const newDecs = [...closingDeclarations]
        newDecs[idx].justification = text
        setClosingDeclarations(newDecs)
    }

    const handleCloseReg = async () => {
        if (isGlobalView || !activeLocId) return toast.error('Debes seleccionar una sede física específica.')
        const invalid = closingDeclarations.find(d => d.difference !== 0 && !d.justification.trim())
        if (invalid) return toast.error(`Justifica la diferencia en: ${invalid.name}`)

        try {
            await close_cash_register({
                id: activeRegId!,
                business_id: filterBusinessId!,
                location_id: activeLocId,
                declarations: closingDeclarations.map(d => ({
                    account_id: d.account_id,
                    expected: d.expected,
                    real: d.real,
                    difference: d.difference,
                    justification: d.justification
                }))
            })
            toast.success('Arqueo Z Completado: Caja Sellada')
            setOpenCloseReg(false)

            // Trigger Z-Report printing with details
            try {
                const zData = await get_z_report_details(activeRegId!)
                const locName = locationsList.find(l => l.id === activeLocId)?.name || 'Sede'
                setReceiptData({ type: 'z_report', location: locName, ...zData })
                setTimeout(() => window.print(), 500)
            } catch { /* non-blocking */ }

            fetchData()
        } catch(e:any) { toast.error(e.message) }
    }

    const handlePayout = async () => {
        if (isGlobalView || !activeLocId) return toast.error('Debes seleccionar una sede física específica.')
        if (!activeRegId) return toast.error('Caja cerrada.')
        try {
            await process_payout({
                business_id: filterBusinessId!, location_id: activeLocId,
                cash_register_id: activeRegId,
                professional_id: formPayout.prof_id,
                account_id: formPayout.account_id,
                amount: formPayout.amount
            })
            toast.success('Liquidación Pagada')
            setOpenPayout(false)
            
            // Print receipt logic
            const prof = professionals.find(p => p.professional_id === formPayout.prof_id)
            const locName = locationsList.find(l => l.id === activeLocId)?.name || 'Sede Principal'
            setReceiptData({
                type: 'payout',
                date: new Date().toISOString(),
                location: locName,
                professional: prof ? `${prof.profile.first_name} ${prof.profile.last_name || ''}` : 'Profesional',
                amount: formPayout.amount,
                balance: (prof ? prof.net_earnings : 0) - formPayout.amount
            })
            setTimeout(() => window.print(), 500)

            fetchData()
        } catch(e:any) { toast.error(e.message) }
    }

    const handleExpense = async () => {
        if (isGlobalView || !activeLocId) return toast.error('Debes seleccionar una sede física específica.')
        if (!activeRegId) return toast.error('Caja cerrada.')
        if (!formExpense.category || !formExpense.account_id || !formExpense.amount) return toast.error('Completa los campos obligatorios.')
        try {
            await create_expense({
                business_id: filterBusinessId!, location_id: activeLocId,
                cash_register_id: activeRegId,
                category: formExpense.category,
                account_id: formExpense.account_id,
                amount: formExpense.amount,
                description: formExpense.description
            })
            toast.success('Gasto registrado con éxito')
            setOpenExpense(false)
            setFormExpense({ category: '', account_id: '', amount: 0, description: '' })
            fetchData()
        } catch(e:any) { toast.error(e.message) }
    }

    if (loading) return <div className="flex items-center justify-center py-24"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>

    if (!filterBusinessId) return (
        <Card className="border-yellow-500/30 bg-yellow-500/5"><CardContent className="py-4 text-center text-yellow-400">Selecciona un negocio para ver el ERP.</CardContent></Card>
    )

    if (!isSuperAdmin && !isAdmin) return (
        <Card className="border-red-500/30 bg-red-500/5"><CardContent className="py-4 text-center text-red-500">Acceso denegado al módulo financiero. Sólo administradores.</CardContent></Card>
    )

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center pr-4 hide-on-print">
                <div><h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2"><ShieldCheck className="w-6 h-6 text-brand" /> ERP Financiero</h1><p className="text-muted-foreground text-sm">Control Operativo e Inmutabilidad Contable</p></div>
                {activeRegId ? (
                    <Badge variant="outline" className="border-green-500 text-green-500 bg-green-500/10 px-3 py-1 flex items-center gap-2 animate-pulse"><Unlock className="w-4 h-4" /> Caja Abierta (RLS Activo)</Badge>
                ) : (
                    <Badge variant="outline" className="border-red-500 text-red-500 bg-red-500/10 px-3 py-1 flex items-center gap-2"><Lock className="w-4 h-4" /> Caja Cerrada (Auditoría Bloqueada)</Badge>
                )}
            </div>

            {receiptData && receiptData.type === 'payout' && (
                <div className="hidden print:block text-black print-container font-mono text-sm leading-tight p-2 w-[80mm] mx-auto absolute top-0 left-0 bg-white">
                    <h2 className="text-center font-bold text-lg mb-2">COMPROBANTE DE PAGO</h2>
                    <h3 className="text-center text-md mb-2">{receiptData.location}</h3>
                    <p className="text-center text-xs mb-4">{new Date(receiptData.date).toLocaleString('es-CO')}</p>
                    <div className="border-t border-b border-black py-2 mb-4">
                        <p><strong>Recibe:</strong> {receiptData.professional}</p>
                        <p><strong>Concepto:</strong> Liquidación Comercial</p>
                    </div>
                    <div className="flex justify-between items-center font-bold text-lg mb-4"><span>VALOR PAGADO:</span><span>{format_currency(receiptData.amount)}</span></div>
                    <div className="flex justify-between items-center text-xs text-gray-600 mb-8"><span>Saldo Pendiente:</span><span>{format_currency(receiptData.balance)}</span></div>
                    <div className="mt-12 border-t border-black pt-2 text-center">
                        <p className="text-xs mb-8">.....................................................</p>
                        <p className="text-xs font-bold">Firma del Profesional</p>
                    </div>
                </div>
            )}

            {receiptData && receiptData.type === 'z_report' && (
                <div className="hidden print:block text-black print-container font-mono text-sm leading-tight p-2 w-[80mm] mx-auto absolute top-0 left-0 bg-white">
                    <h2 className="text-center font-bold text-lg mb-0">REPORTE Z</h2>
                    <h3 className="text-center font-bold text-sm mb-1">AUDITORÍA DE CAJA</h3>
                    <h4 className="text-center text-xs mb-2">{receiptData.location}</h4>
                    <div className="border-t border-black py-1 mb-1 text-xs">
                        <p><strong>Apertura:</strong> {receiptData.opened_at ? new Date(receiptData.opened_at).toLocaleString('es-CO', { timeZone: timezone }) : '—'}</p>
                        <p><strong>Cierre:</strong> {receiptData.closed_at ? new Date(receiptData.closed_at).toLocaleString('es-CO', { timeZone: timezone }) : '—'}</p>
                        <p><strong>Cajero:</strong> {receiptData.opener_name}</p>
                        <p><strong>Responsable Cierre:</strong> {receiptData.closer_name}</p>
                    </div>

                    <div className="border-t border-black py-1 mb-1">
                        <p className="font-bold text-xs uppercase mb-1">+ ENTRADAS</p>
                        {receiptData.breakdown?.filter((b: any) => b.is_income).map((b: any, i: number) => (
                            <div key={i} className="flex justify-between text-xs">
                                <span>{b.label} (x{b.count})</span>
                                <span className="font-bold">+{format_currency(b.total)}</span>
                            </div>
                        ))}
                        <div className="flex justify-between text-xs font-bold border-t border-dotted border-black mt-1 pt-1">
                            <span>TOTAL ENTRADAS</span>
                            <span>+{format_currency(receiptData.total_incomes)}</span>
                        </div>
                    </div>

                    <div className="border-t border-black py-1 mb-1">
                        <p className="font-bold text-xs uppercase mb-1">- SALIDAS</p>
                        {receiptData.breakdown?.filter((b: any) => !b.is_income).map((b: any, i: number) => (
                            <div key={i} className="flex justify-between text-xs">
                                <span>{b.label} (x{b.count})</span>
                                <span className="font-bold">-{format_currency(b.total)}</span>
                            </div>
                        ))}
                        <div className="flex justify-between text-xs font-bold border-t border-dotted border-black mt-1 pt-1">
                            <span>TOTAL SALIDAS</span>
                            <span>-{format_currency(receiptData.total_outcomes)}</span>
                        </div>
                    </div>

                    <div className="border-t border-b border-black py-2 my-2 space-y-1">
                        <div className="flex justify-between text-xs"><span>Base Apertura</span><span>{format_currency(receiptData.base_amount)}</span></div>
                        <div className="flex justify-between text-xs"><span>+ Entradas</span><span>+{format_currency(receiptData.total_incomes)}</span></div>
                        <div className="flex justify-between text-xs"><span>- Salidas</span><span>-{format_currency(receiptData.total_outcomes)}</span></div>
                        <div className="flex justify-between text-xs font-bold border-t border-dotted border-black pt-1"><span>= Saldo Teórico</span><span>{format_currency(receiptData.theoretical_balance)}</span></div>
                        {receiptData.final_amount !== null && (
                            <>
                                <div className="flex justify-between text-xs font-bold"><span>Saldo Físico Declarado</span><span>{format_currency(receiptData.final_amount)}</span></div>
                                <div className={`flex justify-between text-xs font-bold ${(receiptData.difference ?? 0) === 0 ? '' : 'underline'}`}>
                                    <span>Diferencia (Descuadre)</span>
                                    <span>{format_currency(receiptData.difference ?? 0)}</span>
                                </div>
                            </>
                        )}
                    </div>

                    <div className="mt-12 border-t border-black pt-2 text-center">
                        <p className="text-xs mb-8">.....................................................</p>
                        <p className="text-xs font-bold">Firma del Administrador</p>
                        <p className="text-[10px] mt-2 text-gray-500">Documento inmutable de cierre operativo</p>
                    </div>
                </div>
            )}

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full hide-on-print">
                <TabsList className="grid grid-cols-6 bg-muted/30">
                    <TabsTrigger value="pnl">PyG Gerencial</TabsTrigger>
                    <TabsTrigger value="ledger">Libro Mayor</TabsTrigger>
                    <TabsTrigger value="accounts">Cuentas Suma Cero</TabsTrigger>
                    <TabsTrigger value="expenses">Gastos Op.</TabsTrigger>
                    <TabsTrigger value="payouts">Liquidaciones</TabsTrigger>
                    <TabsTrigger value="registers">Cajas</TabsTrigger>
                </TabsList>

                {/* ===== P&L ===== */}
                <TabsContent value="pnl" className="space-y-4 pt-4">
                    <div className="flex flex-col sm:flex-row gap-4 items-end bg-muted/20 p-4 rounded-lg border border-border/50">
                        <div className="grid gap-1.5 flex-1"><Label>Desde</Label><Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} /></div>
                        <div className="grid gap-1.5 flex-1"><Label>Hasta</Label><Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} /></div>
                        <Button variant="outline" onClick={() => fetchData()}>Refrescar Informe</Button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <Card className="border-border/50 bg-card/80 backdrop-blur-sm shadow-md">
                            <CardHeader className="pb-2"><CardTitle className="text-xs font-bold text-muted-foreground uppercase">Ingresos Brutos</CardTitle></CardHeader>
                            <CardContent><div className="text-2xl font-bold flex items-center gap-2"><TrendingUp className="w-5 h-5 text-green-500" />{format_currency(pnl.reduce((a,c)=>a+(c.gross_income || 0),0))}</div></CardContent>
                        </Card>
                        <Card className="border-border/50 bg-card/80 backdrop-blur-sm shadow-md">
                            <CardHeader className="pb-2"><CardTitle className="text-xs font-bold text-muted-foreground uppercase">Costos de Venta</CardTitle></CardHeader>
                            <CardContent><div className="text-2xl font-bold flex items-center gap-2 text-red-400"><TrendingDown className="w-5 h-5" />{format_currency(pnl.reduce((a,c)=>a+(c.cost_of_sales || 0),0))}</div></CardContent>
                        </Card>
                        <Card className="border-border/50 bg-card/80 backdrop-blur-sm shadow-md">
                            <CardHeader className="pb-2"><CardTitle className="text-xs font-bold text-muted-foreground uppercase">Utilidad Bruta</CardTitle></CardHeader>
                            <CardContent><div className="text-2xl font-bold text-brand">{format_currency(pnl.reduce((a,c)=>a+(c.gross_profit || 0),0))}</div></CardContent>
                        </Card>
                        <Card className="border-border/50 bg-gradient-to-br from-brand/10 to-transparent bg-card shadow-lg ring-1 ring-brand/30">
                            <CardHeader className="pb-2"><CardTitle className="text-xs font-bold text-brand uppercase">Utilidad Neta Op.</CardTitle></CardHeader>
                            <CardContent><div className="text-2xl font-bold text-white">{format_currency(pnl.reduce((a,c)=>a+(c.net_operating_profit || 0),0))}</div></CardContent>
                        </Card>
                    </div>
                </TabsContent>

                {/* ===== LEDGER / LIBRO MAYOR ===== */}
                <TabsContent value="ledger" className="space-y-4 pt-4">
                    <div className="flex justify-between items-center">
                        <h3 className="font-semibold text-lg flex items-center gap-2"><History className="w-5 h-5" /> Libro Mayor Central (Libro de Caja)</h3>
                        <div className="text-xs text-muted-foreground bg-muted/50 px-2 py-1 rounded">Visualizando últimos 100 movimientos inmutables</div>
                    </div>
                    <Card className="border-border/50 bg-card/80 backdrop-blur-sm"><CardContent className="p-0 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-muted/30"><tr className="text-muted-foreground font-medium border-b border-border/50">
                                    <th className="py-3 px-4 text-left">Fecha/Hora</th>
                                    <th className="py-3 px-4 text-left">Cuenta</th>
                                    <th className="py-3 px-4 text-left">Concepto</th>
                                    <th className="py-3 px-4 text-left">Responsable</th>
                                    <th className="py-3 px-4 text-right">Valor</th>
                                </tr></thead>
                                <tbody>
                                    {movements.map(m => {
                                        const isIngreso = ['income', 'direct_sale', 'transfer_in', 'opening_balance', 'adjustment_in'].includes(m.type)
                                        return (
                                            <tr key={m.id} className="border-b border-border/20 hover:bg-muted/10 transition-colors">
                                                <td className="py-3 px-4 text-xs font-mono">{new Date(m.created_at).toLocaleString('es-CO', { timeZone: timezone, day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
                                                <td className="py-3 px-4 font-medium">{m.account?.name}</td>
                                                <td className="py-3 px-4 text-muted-foreground">{m.description}</td>
                                                <td className="py-3 px-4 text-xs italic">{m.creator?.first_name || 'Sistema'}</td>
                                                <td className={`py-3 px-4 text-right font-bold ${isIngreso ? 'text-green-500' : 'text-red-500'}`}>
                                                    {isIngreso ? '+' : '-'}{format_currency(m.amount)}
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </CardContent></Card>
                </TabsContent>

                {/* ===== ACCOUNTS ===== */}
                <TabsContent value="accounts" className="space-y-4 pt-4">
                    {isGlobalView && (
                        <div className="bg-yellow-500/10 border-l-4 border-yellow-500 p-4 mb-4 rounded flex items-center gap-3">
                            <AlertTriangle className="w-5 h-5 text-yellow-500 shrink-0" />
                            <p className="text-sm text-yellow-600 dark:text-yellow-400"><strong>Modo de solo lectura.</strong> Selecciona una sede física específica en el filtro superior para habilitar las operaciones de caja y movimientos financieros.</p>
                        </div>
                    )}
                    <div className="flex justify-between items-center">
                        <h3 className="font-semibold text-lg flex items-center gap-2"><Wallet className="w-5 h-5" /> Cuentas & Saldos</h3>
                        <Button className="gradient-brand text-white" disabled={isGlobalView || !activeRegId} onClick={() => setOpenTransfer(true)}><ArrowRightLeft className="w-4 h-4 mr-2" /> Cuadre Suma Cero</Button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        {accounts.map(acc => (
                            <Card key={acc.id} className="border-border/50 bg-card/80 overflow-hidden group hover:border-brand/40 transition-border">
                                <div className={`h-1 w-full ${acc.type === 'cash' ? 'bg-green-500' : 'bg-blue-500'}`} />
                                <CardHeader className="py-3"><CardTitle className="text-sm font-medium text-muted-foreground">{acc.name}</CardTitle></CardHeader>
                                <CardContent><div className="text-2xl font-mono font-bold tracking-tighter">{format_currency(acc.balance)}</div></CardContent>
                            </Card>
                        ))}
                    </div>
                </TabsContent>

                {/* ===== EXPENSES ===== */}
                <TabsContent value="expenses" className="space-y-4 pt-4">
                    {isGlobalView && (
                        <div className="bg-yellow-500/10 border-l-4 border-yellow-500 p-4 mb-4 rounded flex items-center gap-3">
                            <AlertTriangle className="w-5 h-5 text-yellow-500 shrink-0" />
                            <p className="text-sm text-yellow-600 dark:text-yellow-400"><strong>Modo de solo lectura.</strong> Selecciona una sede física específica en el filtro superior para habilitar las operaciones de caja y movimientos financieros.</p>
                        </div>
                    )}
                    <div className="flex justify-between items-center">
                        <h3 className="font-semibold text-lg flex items-center gap-2"><FileText className="w-5 h-5" /> Egresos Operativos</h3>
                        <Button variant="destructive" disabled={isGlobalView || !activeRegId} onClick={() => setOpenExpense(true)}><TrendingDown className="w-4 h-4 mr-2" /> Registrar Gasto</Button>
                    </div>
                    <Card className="border-border/50 bg-card/80"><CardContent className="p-0 overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-muted/10 border-b border-border/50"><tr className="text-muted-foreground font-medium">
                                <td className="py-3 px-4">Fecha</td><td className="py-3 px-4">Categoría</td><td className="py-3 px-4">Descripción</td><td className="py-3 px-4">Cuenta</td><td className="py-3 px-4 text-right">Valor</td>
                            </tr></thead>
                            <tbody>
                                {expenses.map(e => (
                                    <tr key={e.id} className="border-b border-border/20"><td className="py-3 px-4">{new Date(e.created_at).toLocaleDateString()}</td><td className="py-3 px-4"><Badge variant="secondary">{e.category}</Badge></td><td className="py-3 px-4">{e.description}</td><td className="py-3 px-4">{e.account?.name}</td><td className="py-3 px-4 text-right text-red-500 font-bold">{format_currency(e.amount)}</td></tr>
                                ))}
                            </tbody>
                        </table>
                    </CardContent></Card>
                </TabsContent>

                {/* ===== PAYOUTS ===== */}
                <TabsContent value="payouts" className="space-y-4 pt-4">
                    {isGlobalView && (
                        <div className="bg-yellow-500/10 border-l-4 border-yellow-500 p-4 mb-4 rounded flex items-center gap-3">
                            <AlertTriangle className="w-5 h-5 text-yellow-500 shrink-0" />
                            <p className="text-sm text-yellow-600 dark:text-yellow-400"><strong>Modo de solo lectura.</strong> Selecciona una sede física específica en el filtro superior para habilitar las operaciones de caja y movimientos financieros.</p>
                        </div>
                    )}
                    <div className="flex justify-between items-center">
                        <h3 className="font-semibold text-lg flex items-center gap-2"><Banknote className="w-5 h-5" /> Liquidación Profesional</h3>
                        <Button className="gradient-brand text-white" disabled={isGlobalView || !activeRegId} onClick={() => setOpenPayout(true)}><DollarSign className="w-4 h-4 mr-2" /> Generar Payout</Button>
                    </div>
                    <Card className="border-border/50 bg-card/80"><CardContent className="p-0 overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-muted/10 border-b border-border/50"><tr className="text-muted-foreground font-medium">
                                <td className="py-3 px-4">Profesional</td><td className="py-3 px-4 text-right">Acumulado</td><td className="py-3 px-4 text-right">Comisión Neta</td><td className="py-3 px-4 text-right">Descuentos</td>
                            </tr></thead>
                            <tbody>
                                {professionals.map((p, i) => (
                                    <tr key={i} className="border-b border-border/20">
                                        <td className="py-3 px-4">{p.profile?.first_name} {p.profile?.last_name}</td>
                                        <td className="py-3 px-4 text-right">{format_currency(p.gross_income)}</td>
                                        <td className="py-3 px-4 text-right text-brand font-bold">{format_currency(p.commission_earned)}</td>
                                        <td className="py-3 px-4 text-right text-red-400">{format_currency(p.damage_deducted)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </CardContent></Card>
                </TabsContent>

                {/* ===== REGISTERS ===== */}
                <TabsContent value="registers" className="space-y-4 pt-4">
                    {isGlobalView && (
                        <div className="bg-yellow-500/10 border-l-4 border-yellow-500 p-4 mb-4 rounded flex items-center gap-3">
                            <AlertTriangle className="w-5 h-5 text-yellow-500 shrink-0" />
                            <p className="text-sm text-yellow-600 dark:text-yellow-400"><strong>Modo de solo lectura.</strong> Selecciona una sede física específica en el filtro superior para habilitar las operaciones de caja y movimientos financieros.</p>
                        </div>
                    )}
                    <div className="flex justify-between items-center">
                        <h3 className="font-semibold text-lg flex items-center gap-2"><Lock className="w-5 h-5" /> Arqueos de Caja Diarios</h3>
                        <div className="flex gap-2">
                            {activeRegId && (
                                <Button variant="destructive" disabled={isGlobalView} onClick={initCloseRegister}><Lock className="w-4 h-4 mr-2" /> Cerrar Caja (Reporte Z)</Button>
                            )}
                            {!activeRegId && (
                                <Button className="bg-green-600 hover:bg-green-700 text-white" disabled={isGlobalView} onClick={initOpenRegister}><Unlock className="w-4 h-4 mr-2" /> Realizar Apertura</Button>
                            )}
                        </div>
                    </div>
                    <Card className="border-border/50 bg-card/80"><CardContent className="p-0 overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-muted/10 border-b border-border/50"><tr className="text-muted-foreground font-medium">
                                <td className="py-3 px-4">Estado</td><td className="py-3 px-4">Sede</td><td className="py-3 px-4">Apertura</td><td className="py-3 px-4">Cierre</td><td className="py-3 px-4 text-right">Ingresos (+)</td><td className="py-3 px-4 text-right">Gastos (-)</td><td className="py-3 px-4 text-right font-bold">Total Caja</td><td className="py-3 px-4 text-center">Acciones</td>
                            </tr></thead>
                            <tbody>
                                {registers.map(r => (
                                    <tr key={r.id} className="border-b border-border/20">
                                        <td className="py-3 px-4"><Badge variant={r.status==='open'?'default':'secondary'}>{r.status}</Badge></td>
                                        <td className="py-3 px-4 font-medium">{locationsList.find(l => l.id === r.location_id)?.name || 'Sede'}</td>
                                        <td className="py-3 px-4 text-xs">{new Date(r.opened_at).toLocaleString('es-CO', { timeZone: timezone, dateStyle: 'short', timeStyle: 'short' })}<br/><span className="text-muted-foreground">{r.opener_first_name}</span></td>
                                        <td className="py-3 px-4 text-xs">{r.status==='closed' ? new Date(r.closed_at).toLocaleString('es-CO', { timeZone: timezone, dateStyle: 'short', timeStyle: 'short' }) : 'En Progreso'}<br/><span className="text-muted-foreground">{r.status==='closed' ? r.closer_first_name : ''}</span></td>
                                        <td className="py-3 px-4 text-right font-medium text-green-500">+{format_currency(r.total_incomes)}</td>
                                        <td className="py-3 px-4 text-right font-medium text-red-500">-{format_currency(r.total_outcomes)}</td>
                                        <td className="py-3 px-4 text-right font-bold">{format_currency(r.net_cash || r.final_amount || 0)}</td>
                                        <td className="py-3 px-4 text-center">
                                            {r.status === 'closed' && (
                                                <Button variant="ghost" size="sm" disabled={isPrinting} onClick={async () => {
                                                    setIsPrinting(true)
                                                    try {
                                                        const zData = await get_z_report_details(r.id)
                                                        const locName = locationsList.find(l => l.id === activeLocId)?.name || 'Sede'
                                                        setReceiptData({ type: 'z_report', location: locName, ...zData })
                                                        setTimeout(() => {
                                                            window.print()
                                                            setTimeout(() => setIsPrinting(false), 1500)
                                                        }, 500)
                                                    } catch(e: any) { 
                                                        toast.error(e.message)
                                                        setIsPrinting(false)
                                                    }
                                                }}>
                                                    {isPrinting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
                                                </Button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </CardContent></Card>
                </TabsContent>
            </Tabs>

            {/* DIALOGS */}
            <Dialog open={openRegister} onOpenChange={setOpenRegister}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader><DialogTitle className="flex items-center gap-2 text-brand"><Unlock className="w-5 h-5" /> Apertura Dinámica - Arqueo de Saldos</DialogTitle></DialogHeader>
                    <div className="bg-brand/10 border-l-4 border-brand p-2 rounded-r flex items-center gap-2 mt-2 text-brand">
                        <MapPin className="w-4 h-4" />
                        <span className="text-xs font-bold uppercase tracking-wider">Sucursal de Operación: {activeLocationName}</span>
                    </div>
                    <div className="py-4 space-y-4">
                        <p className="text-xs text-muted-foreground mb-4">Verifica el saldo físico de cada cuenta antes de iniciar la operación. El sistema pre-llena los valores esperados del cierre anterior.</p>
                        <div className="border border-border/50 rounded-lg overflow-hidden">
                            <table className="w-full text-sm">
                                <thead className="bg-muted/30 font-medium"><tr>
                                    <td className="p-2">Cuenta</td><td className="p-2 text-right">Esperado</td><td className="p-2 text-right">Real Físico</td><td className="p-2 text-right">Diferencia</td>
                                </tr></thead>
                                <tbody>
                                    {declarations.map((d, i) => (
                                        <tr key={i} className="border-t border-border/30">
                                            <td className="p-2 font-medium">{d.name}</td>
                                            <td className="p-2 text-right text-xs font-mono">{format_currency(d.expected)}</td>
                                            <td className="p-2 text-right">
                                                <Input type="number" value={d.real} className="h-8 w-24 text-right ml-auto" onChange={e => updateDeclaration(i, Number(e.target.value))} />
                                            </td>
                                            <td className={`p-2 text-right font-bold ${d.difference === 0 ? 'text-muted-foreground' : d.difference > 0 ? 'text-green-500' : 'text-red-500'}`}>
                                                {format_currency(d.difference)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        {declarations.some(d => d.difference !== 0) && (
                            <div className="space-y-3 bg-red-500/5 p-3 rounded-lg border border-red-500/20">
                                <Label className="text-red-500 font-bold flex items-center gap-1"><ShieldCheck className="w-4 h-4" /> Justificación de Discrepancias (Obligatorio)</Label>
                                {declarations.map((d, i) => d.difference !== 0 && (
                                    <div key={i} className="space-y-1">
                                        <span className="text-[10px] uppercase font-bold text-muted-foreground">{d.name}</span>
                                        <Input placeholder={`Razón del ${d.difference > 0 ? 'Sobrante' : 'Faltante'}...`} value={d.justification} onChange={e => updateJustification(i, e.target.value)} className="h-8 text-xs border-red-500/30" />
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button className="w-full gradient-brand text-white shadow-lg" onClick={handleOpenReg} disabled={declarations.some(d => d.difference !== 0 && !d.justification.trim())}>Confirmar y Abrir Caja</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={openTransfer} onOpenChange={setOpenTransfer}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Transferencia Suma Cero</DialogTitle></DialogHeader>
                    <div className="bg-brand/10 border-l-4 border-brand p-2 rounded-r flex items-center gap-2 text-brand mt-2">
                        <MapPin className="w-4 h-4" />
                        <span className="text-xs font-bold uppercase tracking-wider">Sucursal de Operación: {activeLocationName}</span>
                    </div>
                    <div className="grid gap-4 py-4">
                        <div><Label>Origen</Label><Select value={formTransfer.from} onValueChange={(v: string | null)=>setFormTransfer(f=>({...f,from:v || ''}))}><SelectTrigger><SelectValue placeholder="Cuenta origen" /></SelectTrigger><SelectContent>{accounts.map(a=><SelectItem key={a.id} value={a.id}>{a.name} ({format_currency(a.balance)})</SelectItem>)}</SelectContent></Select></div>
                        <div><Label>Destino</Label><Select value={formTransfer.to} onValueChange={(v: string | null)=>setFormTransfer(f=>({...f,to:v || ''}))}><SelectTrigger><SelectValue placeholder="Cuenta destino" /></SelectTrigger><SelectContent>{accounts.map(a=><SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent></Select></div>
                        <div><Label>Monto</Label><Input type="number" value={formTransfer.amount} onChange={e=>setFormTransfer(f=>({...f,amount:Number(e.target.value)}))} /></div>
                        <div><Label>Descripción</Label><Input value={formTransfer.desc} onChange={e=>setFormTransfer(f=>({...f,desc:e.target.value}))} /></div>
                    </div>
                <DialogFooter><Button className="w-full gradient-brand text-white" onClick={handleTransfer} disabled={!formTransfer.from || !formTransfer.to || !formTransfer.amount}>Ejecutar Traspaso</Button></DialogFooter></DialogContent>
            </Dialog>

            <Dialog open={openExpense} onOpenChange={setOpenExpense}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Registrar Gasto Operativo</DialogTitle></DialogHeader>
                    <div className="bg-brand/10 border-l-4 border-brand p-2 rounded-r flex items-center gap-2 text-brand mt-2">
                        <MapPin className="w-4 h-4" />
                        <span className="text-xs font-bold uppercase tracking-wider">Sucursal de Operación: {activeLocationName}</span>
                    </div>
                    <div className="grid gap-4 py-4">
                        <div><Label>Categoría</Label><Select value={formExpense.category} onValueChange={(v: string|null)=>setFormExpense(f=>({...f,category:v||''}))}><SelectTrigger><SelectValue placeholder="Ej: Fijo" /></SelectTrigger><SelectContent><SelectItem value="Fijo">Fijo (Arriendo, Nómina)</SelectItem><SelectItem value="Variable">Variable (Servicios, Insumos)</SelectItem></SelectContent></Select></div>
                        <div><Label>Cuenta Base</Label><Select value={formExpense.account_id} onValueChange={(v: string|null)=>setFormExpense(f=>({...f,account_id:v||''}))}><SelectTrigger><SelectValue placeholder="Selecciona Cuenta" /></SelectTrigger><SelectContent>{accounts.map(a=><SelectItem key={a.id} value={a.id}>{a.name} ({format_currency(a.balance)})</SelectItem>)}</SelectContent></Select></div>
                        <div><Label>Monto</Label><Input type="number" value={formExpense.amount} onChange={e=>setFormExpense(f=>({...f,amount:Number(e.target.value)}))} /></div>
                        <div><Label>Descripción</Label><Input value={formExpense.description} onChange={e=>setFormExpense(f=>({...f,description:e.target.value}))} /></div>
                    </div>
                <DialogFooter><Button variant="destructive" className="w-full" onClick={handleExpense} disabled={!formExpense.category || !formExpense.account_id || !formExpense.amount}>Restar de Caja</Button></DialogFooter></DialogContent>
            </Dialog>

            <Dialog open={openCloseReg} onOpenChange={setOpenCloseReg}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader><DialogTitle className="flex items-center gap-2 text-red-500"><Lock className="w-5 h-5" /> Arqueo Final – Reporte Z</DialogTitle></DialogHeader>
                    <div className="bg-brand/10 border-l-4 border-brand p-2 rounded-r flex items-center gap-2 mt-2 text-brand">
                        <MapPin className="w-4 h-4" />
                        <span className="text-xs font-bold uppercase tracking-wider">Sucursal de Operación: {activeLocationName}</span>
                    </div>
                    <div className="py-4 space-y-4">
                        <div className="bg-red-500/10 border border-red-500/30 p-3 rounded-md text-xs text-red-500 mb-2 font-mono">
                            <p><strong>Hora de Apertura:</strong> {activeRegId ? new Date(registers.find(r => r.id === activeRegId)?.opened_at || Date.now()).toLocaleString('es-CO', { timeZone: timezone }) : ''}</p>
                            <p><strong>Hora de Cierre Estimada:</strong> {new Date().toLocaleString('es-CO', { timeZone: timezone })}</p>
                        </div>
                        <div className="bg-red-500/10 border border-red-500/30 p-3 rounded-md text-xs text-red-500 mb-2">Al sellar la caja, todos los movimientos del turno quedarán bloqueados. Verifica cada saldo físico.</div>
                        <div className="border border-border/50 rounded-lg overflow-hidden">
                            <table className="w-full text-sm">
                                <thead className="bg-muted/30 font-medium"><tr>
                                    <td className="p-2">Cuenta</td><td className="p-2 text-right">Saldo Sistema</td><td className="p-2 text-right">Saldo Físico Final</td><td className="p-2 text-right">Diferencia</td>
                                </tr></thead>
                                <tbody>
                                    {closingDeclarations.map((d, i) => (
                                        <tr key={i} className="border-t border-border/30">
                                            <td className="p-2 font-medium">{d.name}</td>
                                            <td className="p-2 text-right text-xs font-mono">{format_currency(d.expected)}</td>
                                            <td className="p-2 text-right">
                                                <Input type="number" value={d.real} className="h-8 w-24 text-right ml-auto" onChange={e => updateClosingDeclaration(i, Number(e.target.value))} />
                                            </td>
                                            <td className={`p-2 text-right font-bold ${d.difference === 0 ? 'text-muted-foreground' : d.difference > 0 ? 'text-green-500' : 'text-red-500'}`}>
                                                {format_currency(d.difference)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        {closingDeclarations.some(d => d.difference !== 0) && (
                            <div className="space-y-3 bg-red-500/5 p-3 rounded-lg border border-red-500/20">
                                <Label className="text-red-500 font-bold flex items-center gap-1"><ShieldCheck className="w-4 h-4" /> Justificación de Discrepancias (Obligatorio)</Label>
                                {closingDeclarations.map((d, i) => d.difference !== 0 && (
                                    <div key={i} className="space-y-1">
                                        <span className="text-[10px] uppercase font-bold text-muted-foreground">{d.name}</span>
                                        <Input placeholder={`Razón del ${d.difference > 0 ? 'Sobrante' : 'Faltante'}...`} value={d.justification} onChange={e => updateClosingJustification(i, e.target.value)} className="h-8 text-xs border-red-500/30" />
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="destructive" className="w-full shadow-lg" onClick={handleCloseReg} disabled={closingDeclarations.some(d => d.difference !== 0 && !d.justification.trim())}>Sellar Caja & Generar Reporte Z</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={openPayout} onOpenChange={setOpenPayout}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Liquidación Profesional</DialogTitle></DialogHeader>
                    <div className="bg-brand/10 border-l-4 border-brand p-2 rounded-r flex items-center gap-2 text-brand mt-2">
                        <MapPin className="w-4 h-4" />
                        <span className="text-xs font-bold uppercase tracking-wider">Sucursal de Operación: {activeLocationName}</span>
                    </div>
                    <div className="grid gap-4 py-4">
                        <div><Label>Profesional</Label><Select value={formPayout.prof_id} onValueChange={(v:string|null)=>setFormPayout(f=>({...f,prof_id:v||''}))}><SelectTrigger><SelectValue placeholder="Elegir profesional" /></SelectTrigger><SelectContent>{professionals.map(p=><SelectItem key={p.professional_id} value={p.professional_id}>{p.profile?.first_name} {p.profile?.last_name} ({format_currency(p.net_earnings)})</SelectItem>)}</SelectContent></Select></div>
                        <div><Label>Cuenta</Label><Select value={formPayout.account_id} onValueChange={(v:string|null)=>setFormPayout(f=>({...f,account_id:v||''}))}><SelectTrigger><SelectValue placeholder="Cuenta de pago" /></SelectTrigger><SelectContent>{accounts.map(a=><SelectItem key={a.id} value={a.id}>{a.name} ({format_currency(a.balance)})</SelectItem>)}</SelectContent></Select></div>
                        <div><Label>Monto</Label><Input type="number" value={formPayout.amount} onChange={e=>setFormPayout(f=>({...f,amount:Number(e.target.value)}))} /></div>
                    </div>
                <DialogFooter><Button className="w-full gradient-brand text-white" onClick={handlePayout} disabled={!formPayout.prof_id || !formPayout.account_id || !formPayout.amount}>Procesar Payout & Imprimir</Button></DialogFooter></DialogContent>
            </Dialog>

            <style dangerouslySetInnerHTML={{ __html: `
                @media print {
                    .hide-on-print { display: none !important; }
                    body { background: white !important; padding: 0 !important; margin: 0 !important; }
                    .print-container { width: 80mm; padding: 0; position: absolute; left: 0; top: 0; margin: 0; }
                }
            `}} />
        </div>
    )
}
