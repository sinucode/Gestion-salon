'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DollarSign, Loader2, TrendingUp, TrendingDown, Wallet, ArrowRightLeft, Lock, Unlock, Banknote } from 'lucide-react'
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
import { open_cash_register, close_cash_register, transfer_funds, process_payout } from '@/actions/finance'

export default function FinanceERPPage() {
    const { user, selectedBusinessId } = useAuthStore()
    const isSuperAdmin = user?.role === 'super_admin'
    const filterBusinessId = isSuperAdmin ? selectedBusinessId : user?.business_id
    const filterLocationId = user?.location_id

    const [loading, setLoading] = useState(true)
    const [activeTab, setActiveTab] = useState('pnl')

    // Data states
    const [pnl, setPnl] = useState<any[]>([])
    const [accounts, setAccounts] = useState<any[]>([])
    const [registers, setRegisters] = useState<any[]>([])
    const [professionals, setProfessionals] = useState<any[]>([])
    const [payouts, setPayouts] = useState<any[]>([])

    // Dialog states
    const [openTransfer, setOpenTransfer] = useState(false)
    const [openRegister, setOpenRegister] = useState(false)
    const [openCloseReg, setOpenCloseReg] = useState(false)
    const [openPayout, setOpenPayout] = useState(false)

    // Form states
    const [formTransfer, setFormTransfer] = useState({ from: '', to: '', amount: 0, desc: '' })
    const [formBase, setFormBase] = useState(0)
    const [formClose, setFormClose] = useState({ amount: 0, notes: '' })
    const [formPayout, setFormPayout] = useState({ prof_id: '', account_id: '', amount: 0 })

    const [activeRegId, setActiveRegId] = useState<string | null>(null)

    const fetchData = async () => {
        if (!filterBusinessId) { setLoading(false); return }
        const supabase = createClient()
        
        let locFilter = filterLocationId
        if (isSuperAdmin && !locFilter) {
            // Pick first location of business for demo if superadmin has none
            const { data: locs } = await supabase.from('locations').select('id').eq('business_id', filterBusinessId).limit(1)
            if (locs?.length) locFilter = locs[0].id
        }

        if (!locFilter) { setLoading(false); return }

        const [
            { data: resPnl },
            { data: resAcc },
            { data: resReg },
            { data: resProf },
            { data: resPay }
        ] = await Promise.all([
            supabase.from('v_pnl').select('*').eq('business_id', filterBusinessId).limit(30),
            supabase.from('accounts').select('*').eq('location_id', locFilter),
            supabase.from('cash_registers').select('*, opener:profiles!cash_registers_opened_by_fkey(first_name), closer:profiles!cash_registers_closed_by_fkey(first_name)').eq('location_id', locFilter).order('created_at', { ascending: false }).limit(20),
            supabase.from('v_professional_earnings').select('*, profile:profiles!v_professional_earnings_professional_id_fkey(first_name, last_name)').eq('location_id', locFilter),
            supabase.from('payouts').select('*, profile:profiles!payouts_professional_id_fkey(first_name)').eq('location_id', locFilter).order('created_at', { ascending: false }).limit(20)
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

        setLoading(false)
    }

    useEffect(() => { setLoading(true); fetchData() }, [filterBusinessId])

    const handleTransfer = async () => {
        if (!activeRegId) return toast.error('Debes abrir caja para transferir.')
        try {
            await transfer_funds({
                business_id: filterBusinessId!, location_id: filterLocationId || '',
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
        try {
            await open_cash_register({ business_id: filterBusinessId!, location_id: filterLocationId || '', base_amount: formBase })
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
        if (!activeRegId) return toast.error('Caja cerrada.')
        try {
            await process_payout({
                business_id: filterBusinessId!, location_id: filterLocationId || '',
                cash_register_id: activeRegId,
                professional_id: formPayout.prof_id,
                account_id: formPayout.account_id,
                amount: formPayout.amount
            })
            toast.success('Liquidación Pagada')
            setOpenPayout(false)
            fetchData()
        } catch(e:any) { toast.error(e.message) }
    }

    if (loading) return <div className="flex items-center justify-center py-24"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>

    if (!filterBusinessId) return (
        <Card className="border-yellow-500/30 bg-yellow-500/5"><CardContent className="py-4 text-center text-yellow-400">Selecciona un negocio para ver el ERP.</CardContent></Card>
    )

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center pr-4">
                <div><h1 className="text-2xl font-bold tracking-tight">ERP Financiero</h1><p className="text-muted-foreground text-sm">Control Operativo y Contable (Doble Partida)</p></div>
                {activeRegId ? (
                    <Badge variant="outline" className="border-green-500 text-green-500 bg-green-500/10 px-3 py-1 flex items-center gap-2"><Unlock className="w-4 h-4" /> Caja Abierta</Badge>
                ) : (
                    <Badge variant="outline" className="border-red-500 text-red-500 bg-red-500/10 px-3 py-1 flex items-center gap-2"><Lock className="w-4 h-4" /> Caja Cerrada</Badge>
                )}
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid grid-cols-4 bg-muted/30">
                    <TabsTrigger value="pnl">PyG Gerencial</TabsTrigger>
                    <TabsTrigger value="accounts">Suma Cero & Cuentas</TabsTrigger>
                    <TabsTrigger value="payouts">Liquidaciones</TabsTrigger>
                    <TabsTrigger value="registers">Cierres de Caja</TabsTrigger>
                </TabsList>

                {/* ===== P&L ===== */}
                <TabsContent value="pnl" className="space-y-4 pt-4">
                    <div className="grid grid-cols-3 gap-4">
                        <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
                            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Ingresos (Ventas/Citas)</CardTitle></CardHeader>
                            <CardContent><div className="text-2xl font-bold text-green-500 flex items-center gap-2"><TrendingUp className="w-5 h-5" />{format_currency(pnl.reduce((a,c)=>a+c.gross_income,0))}</div></CardContent>
                        </Card>
                        <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
                            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Costos (Inv + Comisiones)</CardTitle></CardHeader>
                            <CardContent><div className="text-2xl font-bold text-red-500 flex items-center gap-2"><TrendingDown className="w-5 h-5" />{format_currency(pnl.reduce((a,c)=>a+c.inventory_cost+c.commissions,0))}</div></CardContent>
                        </Card>
                        <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
                            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Utilidad Bruta (Net Profit)</CardTitle></CardHeader>
                            <CardContent><div className="text-2xl font-bold text-brand">{format_currency(pnl.reduce((a,c)=>a+c.net_profit,0))}</div></CardContent>
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
                        <div><Label>Profesional</Label><Select value={formPayout.prof_id} onValueChange={(v: string | null)=>setFormPayout(f=>({...f,prof_id:v || ''}))}><SelectTrigger><SelectValue placeholder="Elegir profesional" /></SelectTrigger><SelectContent>{professionals.map(p=><SelectItem key={p.professional_id} value={p.professional_id}>{p.profile?.first_name} {p.profile?.last_name} ({format_currency(p.commission_earned - p.damage_deducted)})</SelectItem>)}</SelectContent></Select></div>
                        <div><Label>Descontar de la cuenta:</Label><Select value={formPayout.account_id} onValueChange={(v: string | null)=>setFormPayout(f=>({...f,account_id:v || ''}))}><SelectTrigger><SelectValue placeholder="Cuenta de donde sale el dinero" /></SelectTrigger><SelectContent>{accounts.map(a=><SelectItem key={a.id} value={a.id}>{a.name} ({format_currency(a.balance)})</SelectItem>)}</SelectContent></Select></div>
                        <div><Label>Monto a Liquidar</Label><Input type="number" value={formPayout.amount} onChange={e=>setFormPayout(f=>({...f,amount:Number(e.target.value)}))} /></div>
                    </div>
                <DialogFooter><Button onClick={handlePayout} disabled={!formPayout.prof_id || !formPayout.account_id || !formPayout.amount}>Procesar Salida y Generar Tirilla</Button></DialogFooter></DialogContent>
            </Dialog>
        </div>
    )
}
