'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DollarSign, Loader2, TrendingUp, TrendingDown, Wallet, ArrowRightLeft, Lock, Unlock, Banknote, FileText, Printer } from 'lucide-react'
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
import { open_cash_register, close_cash_register, transfer_funds, process_payout, create_expense } from '@/actions/finance'

export default function FinanceERPPage() {
    const { user, selectedBusinessId } = useAuthStore()
    const isSuperAdmin = user?.role === 'super_admin'
    const isAdmin = user?.role === 'admin'
    const filterBusinessId = isSuperAdmin ? selectedBusinessId : user?.business_id
    const defaultLocationId = user?.location_id

    const [loading, setLoading] = useState(true)
    const [activeTab, setActiveTab] = useState('pnl')

    // Filters for P&L
    const defaultStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]
    const defaultEnd = new Date().toISOString().split('T')[0]
    const [startDate, setStartDate] = useState(defaultStart)
    const [endDate, setEndDate] = useState(defaultEnd)
    const [selectedLocation, setSelectedLocation] = useState<string>('')
    const [locationsList, setLocationsList] = useState<any[]>([])

    // Data states
    const [pnl, setPnl] = useState<any[]>([])
    const [accounts, setAccounts] = useState<any[]>([])
    const [registers, setRegisters] = useState<any[]>([])
    const [professionals, setProfessionals] = useState<any[]>([])
    const [payouts, setPayouts] = useState<any[]>([])
    const [expenses, setExpenses] = useState<any[]>([])

    // Dialog states
    const [openTransfer, setOpenTransfer] = useState(false)
    const [openRegister, setOpenRegister] = useState(false)
    const [openCloseReg, setOpenCloseReg] = useState(false)
    const [openPayout, setOpenPayout] = useState(false)
    const [openExpense, setOpenExpense] = useState(false)

    // Form states
    const [formTransfer, setFormTransfer] = useState({ from: '', to: '', amount: 0, desc: '' })
    const [formBase, setFormBase] = useState(0)
    const [formClose, setFormClose] = useState({ amount: 0, notes: '' })
    const [formPayout, setFormPayout] = useState({ prof_id: '', account_id: '', amount: 0 })
    const [formExpense, setFormExpense] = useState({ category: '', account_id: '', amount: 0, description: '' })

    const [activeRegId, setActiveRegId] = useState<string | null>(null)
    const [activeLocId, setActiveLocId] = useState<string | null>(null)

    // Printing state
    const [receiptData, setReceiptData] = useState<any>(null)

    const fetchData = async () => {
        if (!filterBusinessId) { setLoading(false); return }
        const supabase = createClient()
        
        let locFilter = selectedLocation || defaultLocationId
        
        // Fetch locations list for superadmin/admin if not loaded
        if ((isSuperAdmin || isAdmin) && locationsList.length === 0) {
            const { data: locs } = await supabase.from('locations').select('id, name').eq('business_id', filterBusinessId)
            if (locs) {
                setLocationsList(locs)
                if (!locFilter && locs.length > 0) locFilter = locs[0].id
                if (!selectedLocation && locFilter) setSelectedLocation(locFilter)
            }
        }

        if (!locFilter) { setLoading(false); return }
        setActiveLocId(locFilter)

        // Date range filtering for P&L
        let pnlQuery = supabase.from('v_pnl').select('*').eq('business_id', filterBusinessId)
        if (locFilter) pnlQuery = pnlQuery.eq('location_id', locFilter)
        if (startDate) pnlQuery = pnlQuery.gte('date', startDate)
        if (endDate) pnlQuery = pnlQuery.lte('date', endDate)

        const [
            { data: resPnl },
            { data: resAcc },
            { data: resReg },
            { data: resProf },
            { data: resPay },
            { data: resExp }
        ] = await Promise.all([
            pnlQuery,
            supabase.from('accounts').select('*').eq('location_id', locFilter),
            supabase.from('cash_registers').select('*, opener:profiles!cash_registers_opened_by_fkey(first_name), closer:profiles!cash_registers_closed_by_fkey(first_name)').eq('location_id', locFilter).order('created_at', { ascending: false }).limit(20),
            supabase.from('v_professional_earnings').select('*, profile:profiles!v_professional_earnings_professional_id_fkey(first_name, last_name)').eq('location_id', locFilter),
            supabase.from('payouts').select('*, profile:profiles!payouts_professional_id_fkey(first_name)').eq('location_id', locFilter).order('created_at', { ascending: false }).limit(20),
            supabase.from('operating_expenses').select('*, creator:profiles!operating_expenses_created_by_fkey(first_name), account:accounts!operating_expenses_account_id_fkey(name)').eq('location_id', locFilter).order('created_at', { ascending: false }).limit(20)
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

        setLoading(false)
    }

    useEffect(() => { setLoading(true); fetchData() }, [filterBusinessId, startDate, endDate, selectedLocation])

    const handleTransfer = async () => {
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

    const handleOpenReg = async () => {
        if (!activeLocId) return toast.error('No hay sede seleccionada.')
        try {
            await open_cash_register({ business_id: filterBusinessId!, location_id: activeLocId, base_amount: formBase })
            toast.success('Caja Abierta')
            setOpenRegister(false)
            fetchData()
        } catch(e:any) { toast.error(e.message) }
    }

    const handleCloseReg = async () => {
        try {
            await close_cash_register(activeRegId!, formClose.amount, formClose.notes)
            toast.success('Arqueo Completado: Caja Cerrada')
            setOpenCloseReg(false)
            fetchData()
        } catch(e:any) { toast.error(e.message) }
    }

    const handlePayout = async () => {
        if (!activeRegId || !activeLocId) return toast.error('Caja cerrada.')
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
        if (!activeRegId || !activeLocId) return toast.error('Caja cerrada.')
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

    // Unauthorized for non-admins (Double Check)
    if (!isSuperAdmin && !isAdmin) return (
        <Card className="border-red-500/30 bg-red-500/5"><CardContent className="py-4 text-center text-red-500">Acceso denegado al módulo financiero. Sólo administradores.</CardContent></Card>
    )

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center pr-4 hide-on-print">
                <div><h1 className="text-2xl font-bold tracking-tight">ERP Financiero</h1><p className="text-muted-foreground text-sm">Control Operativo y Contable (Doble Partida)</p></div>
                {activeRegId ? (
                    <Badge variant="outline" className="border-green-500 text-green-500 bg-green-500/10 px-3 py-1 flex items-center gap-2"><Unlock className="w-4 h-4" /> Caja Abierta</Badge>
                ) : (
                    <Badge variant="outline" className="border-red-500 text-red-500 bg-red-500/10 px-3 py-1 flex items-center gap-2"><Lock className="w-4 h-4" /> Caja Cerrada</Badge>
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
                    
                    <div className="flex justify-between items-center font-bold text-lg mb-4">
                        <span>VALOR PAGADO:</span>
                        <span>{format_currency(receiptData.amount)}</span>
                    </div>
                    
                    <div className="flex justify-between items-center text-xs text-gray-600 mb-8">
                        <span>Saldo Pendiente:</span>
                        <span>{format_currency(receiptData.balance)}</span>
                    </div>

                    <div className="mt-12 border-t border-black pt-2 text-center">
                        <p className="text-xs mb-8">.....................................................</p>
                        <p className="text-xs font-bold">Firma del Profesional</p>
                        <p className="text-[10px] mt-2 text-gray-500">Documento de constancia de egreso operativo</p>
                    </div>
                </div>
            )}

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full hide-on-print">
                <TabsList className="grid grid-cols-5 bg-muted/30">
                    <TabsTrigger value="pnl">PyG Gerencial</TabsTrigger>
                    <TabsTrigger value="accounts">Suma Cero & Cuentas</TabsTrigger>
                    <TabsTrigger value="expenses">Gastos Op.</TabsTrigger>
                    <TabsTrigger value="payouts">Liquidaciones</TabsTrigger>
                    <TabsTrigger value="registers">Cierres de Caja</TabsTrigger>
                </TabsList>

                {/* ===== P&L ===== */}
                <TabsContent value="pnl" className="space-y-4 pt-4">
                    <div className="flex flex-col sm:flex-row gap-4 items-end bg-muted/20 p-4 rounded-lg border border-border/50">
                        <div className="grid gap-1.5 flex-1">
                            <Label>Desde</Label>
                            <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
                        </div>
                        <div className="grid gap-1.5 flex-1">
                            <Label>Hasta</Label>
                            <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
                        </div>
                        {(isSuperAdmin || isAdmin) && locationsList.length > 0 && (
                            <div className="grid gap-1.5 flex-1">
                                <Label>Reporte de Sede</Label>
                                <Select value={selectedLocation} onValueChange={(v: string | null) => setSelectedLocation(v || '')}>
                                    <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Consolidado Global</SelectItem>
                                        {locationsList.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}
                        <Button variant="outline" onClick={() => fetchData()}>Filtrar</Button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
                            <CardHeader className="pb-2"><CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Ingresos Brutos</CardTitle></CardHeader>
                            <CardContent><div className="text-2xl font-bold flex items-center gap-2"><TrendingUp className="w-5 h-5 text-green-500" />{format_currency(pnl.reduce((a,c)=>a+(c.gross_income || 0),0))}</div>
                            <p className="text-xs text-muted-foreground mt-1">Ventas Libres + Citas</p></CardContent>
                        </Card>
                        <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
                            <CardHeader className="pb-2"><CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Costos de Venta</CardTitle></CardHeader>
                            <CardContent><div className="text-2xl font-bold flex items-center gap-2"><TrendingDown className="w-5 h-5 text-red-400" />{format_currency(pnl.reduce((a,c)=>a+(c.cost_of_sales || 0),0))}</div>
                            <p className="text-xs text-muted-foreground mt-1">Inv. Consumido + Comisiones</p></CardContent>
                        </Card>
                        <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
                            <CardHeader className="pb-2"><CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Utilidad Bruta</CardTitle></CardHeader>
                            <CardContent><div className="text-2xl font-bold flex items-center gap-2"><Wallet className="w-5 h-5 text-brand" />{format_currency(pnl.reduce((a,c)=>a+(c.gross_profit || 0),0))}</div>
                            <p className="text-xs text-muted-foreground mt-1">Ingresos - Costos Venta</p></CardContent>
                        </Card>
                        <Card className="border-border/50 bg-gradient-to-br from-card to-muted bg-card/80 backdrop-blur-sm shadow-sm ring-1 ring-brand/20">
                            <CardHeader className="pb-2"><CardTitle className="text-xs font-bold text-brand uppercase tracking-wider">Utilidad Neta Operativa</CardTitle></CardHeader>
                            <CardContent><div className="text-2xl font-bold flex items-center gap-2 text-brand"><Banknote className="w-5 h-5" />{format_currency(pnl.reduce((a,c)=>a+(c.net_operating_profit || 0),0))}</div>
                            <p className="text-xs text-muted-foreground mt-1">Restando Gastos Operativos</p></CardContent>
                        </Card>
                    </div>
                </TabsContent>

                {/* ===== ACCOUNTS ===== */}
                <TabsContent value="accounts" className="space-y-4 pt-4">
                    <div className="flex justify-between items-center">
                        <h3 className="font-semibold text-lg flex items-center gap-2"><Wallet className="w-5 h-5" /> Cuentas Dinámicas</h3>
                        <Button className="gradient-brand text-white" disabled={!activeRegId} onClick={() => setOpenTransfer(true)}><ArrowRightLeft className="w-4 h-4 mr-2" /> Cuadre Suma Cero</Button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        {accounts.map(acc => (
                            <Card key={acc.id} className="border-border/50 bg-card/80 relative overflow-hidden">
                                <div className={`absolute top-0 left-0 w-1 h-full ${acc.type === 'cash' ? 'bg-green-500' : 'bg-blue-500'}`} />
                                <CardHeader className="pb-2 pl-6"><CardTitle className="text-md">{acc.name}</CardTitle></CardHeader>
                                <CardContent className="pl-6"><div className="text-2xl font-mono font-bold">{format_currency(acc.balance)}</div></CardContent>
                            </Card>
                        ))}
                    </div>
                </TabsContent>

                {/* ===== EXPENSES ===== */}
                <TabsContent value="expenses" className="space-y-4 pt-4">
                    <div className="flex justify-between items-center">
                        <h3 className="font-semibold text-lg flex items-center gap-2"><FileText className="w-5 h-5" /> Registro de Egresos</h3>
                        <Button variant="destructive" disabled={!activeRegId} onClick={() => setOpenExpense(true)}><TrendingDown className="w-4 h-4 mr-2" /> Registrar Gasto Operativo</Button>
                    </div>
                    <Card className="border-border/50 bg-card/80"><CardContent className="p-0">
                        <table className="w-full text-sm">
                            <thead className="border-b border-border/50"><tr className="text-muted-foreground font-medium">
                                <td className="py-3 px-4">Fecha</td><td className="py-3 px-4">Categoría</td><td className="py-3 px-4">Descripción</td><td className="py-3 px-4">Cuenta Base</td><td className="py-3 px-4 text-right">Monto</td>
                            </tr></thead>
                            <tbody>
                                {expenses.map(e => (
                                    <tr key={e.id} className="border-b border-border/20">
                                        <td className="py-3 px-4">{new Date(e.created_at).toLocaleDateString('es-CO')}</td>
                                        <td className="py-3 px-4"><Badge variant="outline">{e.category}</Badge></td>
                                        <td className="py-3 px-4 text-muted-foreground">{e.description}</td>
                                        <td className="py-3 px-4">{e.account?.name}</td>
                                        <td className="py-3 px-4 text-right text-red-500 font-bold">{format_currency(e.amount)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </CardContent></Card>
                </TabsContent>

                {/* ===== PAYOUTS ===== */}
                <TabsContent value="payouts" className="space-y-4 pt-4">
                    <div className="flex justify-between items-center">
                        <h3 className="font-semibold text-lg flex items-center gap-2"><Banknote className="w-5 h-5" /> Estado de Profesionales</h3>
                        <Button className="gradient-brand text-white" disabled={!activeRegId} onClick={() => setOpenPayout(true)}><DollarSign className="w-4 h-4 mr-2" /> Liquidar (Payout)</Button>
                    </div>
                    <Card className="border-border/50 bg-card/80"><CardContent className="p-0">
                        <table className="w-full text-sm">
                            <thead className="border-b border-border/50"><tr className="text-muted-foreground font-medium">
                                <td className="py-3 px-4">Profesional</td><td className="py-3 px-4 text-right">Producido</td><td className="py-3 px-4 text-right">Comisión a Pagar</td><td className="py-3 px-4 text-right">Descuentos Daños</td>
                            </tr></thead>
                            <tbody>
                                {professionals.map((p, i) => (
                                    <tr key={i} className="border-b border-border/20">
                                        <td className="py-3 px-4">{p.profile?.first_name} {p.profile?.last_name}</td>
                                        <td className="py-3 px-4 text-right">{format_currency(p.gross_income)}</td>
                                        <td className="py-3 px-4 text-right text-brand font-bold">{format_currency(p.commission_earned)}</td>
                                        <td className="py-3 px-4 text-right text-red-500">{format_currency(p.damage_deducted)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </CardContent></Card>
                </TabsContent>

                {/* ===== REGISTERS ===== */}
                <TabsContent value="registers" className="space-y-4 pt-4">
                    <div className="flex justify-between items-center">
                        <h3 className="font-semibold text-lg flex items-center gap-2"><Lock className="w-5 h-5" /> Arqueos de Caja</h3>
                        {activeRegId ? (
                             <Button variant="destructive" onClick={() => setOpenCloseReg(true)}><Lock className="w-4 h-4 mr-2" /> Cerrar Caja (Bloquear RLS)</Button>
                        ) : (
                             <Button className="bg-green-600 hover:bg-green-700 text-white" onClick={() => setOpenRegister(true)}><Unlock className="w-4 h-4 mr-2" /> Abrir Caja</Button>
                        )}
                    </div>
                    <Card className="border-border/50 bg-card/80"><CardContent className="p-0">
                        <table className="w-full text-sm">
                            <thead className="border-b border-border/50"><tr className="text-muted-foreground font-medium">
                                <td className="py-3 px-4">Fecha</td><td className="py-3 px-4">Estado</td><td className="py-3 px-4 text-right">Base</td><td className="py-3 px-4 text-right">Cierre</td><td className="py-3 px-4">Responsable</td>
                            </tr></thead>
                            <tbody>
                                {registers.map(r => (
                                    <tr key={r.id} className="border-b border-border/20 hover:bg-muted/10">
                                        <td className="py-3 px-4">{new Date(r.opened_at).toLocaleDateString('es-CO')}</td>
                                        <td className="py-3 px-4"><Badge variant="outline" className={r.status==='open'?'text-green-500':'text-gray-500'}>{r.status}</Badge></td>
                                        <td className="py-3 px-4 text-right">{format_currency(r.base_amount)}</td>
                                        <td className="py-3 px-4 text-right font-medium">{r.final_amount !== null ? format_currency(r.final_amount) : '—'}</td>
                                        <td className="py-3 px-4 text-muted-foreground">{r.opener?.first_name}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </CardContent></Card>
                </TabsContent>
            </Tabs>

            <Dialog open={openTransfer} onOpenChange={setOpenTransfer}>
                <DialogContent><DialogHeader><DialogTitle>Transferencia Suma Cero</DialogTitle></DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div><Label>Origen (Resta)</Label><Select value={formTransfer.from} onValueChange={(v: string | null)=>setFormTransfer(f=>({...f,from:v || ''}))}><SelectTrigger><SelectValue placeholder="Cuenta origen" /></SelectTrigger><SelectContent>{accounts.map(a=><SelectItem key={a.id} value={a.id}>{a.name} ({format_currency(a.balance)})</SelectItem>)}</SelectContent></Select></div>
                        <div><Label>Destino (Suma)</Label><Select value={formTransfer.to} onValueChange={(v: string | null)=>setFormTransfer(f=>({...f,to:v || ''}))}><SelectTrigger><SelectValue placeholder="Cuenta destino" /></SelectTrigger><SelectContent>{accounts.map(a=><SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent></Select></div>
                        <div><Label>Monto EXACTO a mover</Label><Input type="number" value={formTransfer.amount} onChange={e=>setFormTransfer(f=>({...f,amount:Number(e.target.value)}))} /></div>
                        <div><Label>Descripción (Revisión Auditoría)</Label><Input value={formTransfer.desc} onChange={e=>setFormTransfer(f=>({...f,desc:e.target.value}))} /></div>
                    </div>
                <DialogFooter><Button onClick={handleTransfer} disabled={!formTransfer.from || !formTransfer.to || !formTransfer.amount}>Ejecutar Suma Cero</Button></DialogFooter></DialogContent>
            </Dialog>

            <Dialog open={openExpense} onOpenChange={setOpenExpense}>
                <DialogContent><DialogHeader><DialogTitle>Registrar Gasto Operativo</DialogTitle></DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div><Label>Categoría de Gasto</Label>
                            <Select value={formExpense.category} onValueChange={(v: string | null)=>setFormExpense(f=>({...f,category:v || ''}))}>
                                <SelectTrigger><SelectValue placeholder="Ej: Fijo" /></SelectTrigger>
                                <SelectContent><SelectItem value="Fijo">Fijo (Arriendo, Nómina, Suscripciones)</SelectItem><SelectItem value="Variable">Variable (Servicios P., Insumos Aseo)</SelectItem></SelectContent>
                            </Select>
                        </div>
                        <div><Label>Sustraer Dinero De:</Label><Select value={formExpense.account_id} onValueChange={(v: string | null)=>setFormExpense(f=>({...f,account_id:v || ''}))}><SelectTrigger><SelectValue placeholder="Selecciona Cuenta" /></SelectTrigger><SelectContent>{accounts.map(a=><SelectItem key={a.id} value={a.id}>{a.name} ({format_currency(a.balance)})</SelectItem>)}</SelectContent></Select></div>
                        <div><Label>Monto del Gasto</Label><Input type="number" value={formExpense.amount} onChange={e=>setFormExpense(f=>({...f,amount:Number(e.target.value)}))} /></div>
                        <div><Label>Descripción Breve</Label><Input value={formExpense.description} onChange={e=>setFormExpense(f=>({...f,description:e.target.value}))} /></div>
                    </div>
                <DialogFooter><Button variant="destructive" onClick={handleExpense} disabled={!formExpense.category || !formExpense.account_id || !formExpense.amount}>Restar y Guardar</Button></DialogFooter></DialogContent>
            </Dialog>

            <Dialog open={openRegister} onOpenChange={setOpenRegister}>
                <DialogContent><DialogHeader><DialogTitle>Apertura de Caja (Día)</DialogTitle></DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div><Label>Dinero en Efectivo (Base Física)</Label><Input type="number" value={formBase} onChange={e=>setFormBase(Number(e.target.value))} /></div>
                    </div>
                <DialogFooter><Button className="bg-green-600 outline-none hover:bg-green-700 text-white" onClick={handleOpenReg}>Iniciar Reto Diario</Button></DialogFooter></DialogContent>
            </Dialog>

            <Dialog open={openCloseReg} onOpenChange={setOpenCloseReg}>
                <DialogContent><DialogHeader><DialogTitle className="text-red-500">Arqueo Final de Caja</DialogTitle></DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="bg-red-500/10 border border-red-500/30 p-3 rounded-md text-xs text-red-500 mb-2">
                            Al cerrar la caja, todos los movimientos de hoy quedarán bloqueados por seguridad RLS.
                        </div>
                        <div><Label>Conteo Final Real Física (Efectivo General)</Label><Input type="number" value={formClose.amount} onChange={e=>setFormClose(f=>({...f,amount:Number(e.target.value)}))} /></div>
                        <div><Label>Notas de Cuadre</Label><Input value={formClose.notes} onChange={e=>setFormClose(f=>({...f,notes:e.target.value}))} /></div>
                    </div>
                <DialogFooter><Button variant="destructive" onClick={handleCloseReg}>Sellar Caja Permanentemente</Button></DialogFooter></DialogContent>
            </Dialog>

            <Dialog open={openPayout} onOpenChange={setOpenPayout}>
                <DialogContent><DialogHeader><DialogTitle>Liquidación a Demanda (Payout)</DialogTitle></DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div><Label>Profesional</Label><Select value={formPayout.prof_id} onValueChange={(v: string | null)=>setFormPayout(f=>({...f,prof_id:v || ''}))}><SelectTrigger><SelectValue placeholder="Elegir profesional" /></SelectTrigger><SelectContent>{professionals.map(p=><SelectItem key={p.professional_id} value={p.professional_id}>{p.profile?.first_name} {p.profile?.last_name} ({format_currency((p.net_earnings || 0))})</SelectItem>)}</SelectContent></Select></div>
                        <div><Label>Descontar de la cuenta:</Label><Select value={formPayout.account_id} onValueChange={(v: string | null)=>setFormPayout(f=>({...f,account_id:v || ''}))}><SelectTrigger><SelectValue placeholder="Cuenta de donde sale el dinero" /></SelectTrigger><SelectContent>{accounts.map(a=><SelectItem key={a.id} value={a.id}>{a.name} ({format_currency(a.balance)})</SelectItem>)}</SelectContent></Select></div>
                        <div><Label>Monto a Liquidar</Label><Input type="number" value={formPayout.amount} onChange={e=>setFormPayout(f=>({...f,amount:Number(e.target.value)}))} /></div>
                    </div>
                <DialogFooter><Button onClick={handlePayout} disabled={!formPayout.prof_id || !formPayout.account_id || !formPayout.amount}>Procesar Salida y Generar Tirilla</Button></DialogFooter></DialogContent>
            </Dialog>

            {/* Global style for printing thermal receipts */}
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
