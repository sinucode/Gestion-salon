'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CalendarDays, Loader2, CheckCircle2, Play, X, UserX, Search, ShoppingCart, Trash2, MapPin, AlertCircle, Receipt, DollarSign } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores'
import { toast } from 'sonner'
import { format_currency } from '@/lib/utils/currency'
import { process_appointment_checkout, updateAppointmentStatus } from '@/actions/appointments'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'

interface Appointment {
    id: string; status: string; total_price: number; starts_at: string; ends_at: string; notes: string | null; location_id: string
    professional: { first_name: string; last_name: string } | null
    client: { first_name: string; last_name: string } | null
    services: { name: string; price: number }[]
}

interface Product {
    id: string; name: string; stock_qty: number; cost_per_unit: number
}

interface Account {
    id: string; name: string; balance: number
}

const STATUS_LABELS: Record<string, string> = { scheduled: 'Agendada', in_progress: 'En Progreso', completed: 'Completada', approved: 'Aprobada', cancelled: 'Cancelada', no_show: 'No Asistió' }
const STATUS_COLORS: Record<string, string> = { scheduled: 'bg-blue-500/10 text-blue-500', in_progress: 'bg-yellow-500/10 text-yellow-500', completed: 'bg-green-500/10 text-green-500', approved: 'bg-emerald-500/10 text-emerald-500', cancelled: 'bg-red-500/10 text-red-500', no_show: 'bg-gray-500/10 text-gray-500' }

export default function AppointmentsPage() {
    const { user, selectedBusinessId } = useAuthStore()
    const isSuperAdmin = user?.role === 'super_admin'
    const filterBusinessId = isSuperAdmin ? selectedBusinessId : user?.business_id

    const [appointments, setAppointments] = useState<Appointment[]>([])
    const [loading, setLoading] = useState(true)

    // Checkout modal states
    const [isCheckoutOpen, setIsCheckoutOpen] = useState(false)
    const [selectedAppt, setSelectedAppt] = useState<Appointment | null>(null)
    const [isProcessing, setIsProcessing] = useState(false)
    const [locationsList, setLocationsList] = useState<any[]>([])
    
    // Lists for checkout
    const [productsList, setProductsList] = useState<Product[]>([])
    const [accountsList, setAccountsList] = useState<Account[]>([])
    const [openRegister, setOpenRegister] = useState<any>(null)
    
    // Selection state
    const [selectedAccountId, setSelectedAccountId] = useState('')
    const [extraProducts, setExtraProducts] = useState<{ product_id: string, name: string, qty: number, price: number }[]>([])
    const [productSearch, setProductSearch] = useState('')

    const activeLocationName = locationsList.find(l => l.id === (selectedAppt?.location_id || ''))?.name || 'Sede'

    const fetchAppointments = async () => {
        if (!filterBusinessId && !isSuperAdmin) { setLoading(false); return }
        const supabase = createClient()
        
        // Fetch locations for labels
        if (filterBusinessId && locationsList.length === 0) {
            const { data: locs } = await supabase.from('locations').select('id, name').eq('business_id', filterBusinessId)
            if (locs) setLocationsList(locs)
        }

        let query = supabase.from('appointments')
            .select('id, status, total_price, starts_at, ends_at, notes, location_id, professional:profiles!appointments_professional_id_fkey(first_name, last_name), client:profiles!appointments_client_id_fkey(first_name, last_name), services:appointment_services(name:services(name), price:services(price))')
            .order('starts_at', { ascending: false }).limit(30)
        if (filterBusinessId) query = query.eq('business_id', filterBusinessId)
        const { data } = await query
        if (data) setAppointments(data as unknown as Appointment[])
        setLoading(false)
    }

    const openCheckoutModal = async (appt: Appointment) => {
        setSelectedAppt(appt)
        setExtraProducts([])
        setSelectedAccountId('')
        setProductSearch('')
        setIsCheckoutOpen(true)
        
        const supabase = createClient()
        const [resProds, resAccs, resReg] = await Promise.all([
            supabase.from('products').select('id, name, stock_qty, cost_per_unit').eq('location_id', appt.location_id).eq('is_active', true),
            supabase.from('accounts').select('id, name, balance').eq('location_id', appt.location_id).eq('is_active', true),
            supabase.from('cash_registers').select('*').eq('location_id', appt.location_id).eq('status', 'open').maybeSingle()
        ])
        
        if (resProds.data) setProductsList(resProds.data as Product[])
        if (resAccs.data) setAccountsList(resAccs.data as Account[])
        setOpenRegister(resReg.data)
    }

    const addProductToCheckout = (p: Product) => {
        const existing = extraProducts.find(x => x.product_id === p.id)
        if (existing) {
            setExtraProducts(extraProducts.map(x => x.product_id === p.id ? { ...x, qty: x.qty + 1 } : x))
        } else {
            const price = p.cost_per_unit * 1.5
            setExtraProducts([...extraProducts, { product_id: p.id, name: p.name, qty: 1, price }])
        }
        setProductSearch('')
    }

    const removeProductFromCheckout = (id: string) => {
        setExtraProducts(extraProducts.filter(x => x.product_id !== id))
    }

    const updateProductQty = (id: string, qty: number) => {
        if (qty <= 0) return
        setExtraProducts(extraProducts.map(x => x.product_id === id ? { ...x, qty } : x))
    }

    const handleCheckout = async () => {
        if (!selectedAppt || !selectedAccountId || !openRegister) return
        setIsProcessing(true)
        try {
            await process_appointment_checkout({
                appointmentId: selectedAppt.id,
                cashRegisterId: openRegister.id,
                accountId: selectedAccountId,
                additionalProducts: extraProducts.map(p => ({
                    product_id: p.product_id,
                    qty: p.qty,
                    price: p.price
                }))
            })
            toast.success('Cobro procesado con éxito')
            setIsCheckoutOpen(false)
            fetchAppointments()
        } catch (e: any) {
            toast.error(e.message)
        } finally {
            setIsProcessing(false)
        }
    }

    const changeStatus = async (id: string, status: any) => {
        try {
            await updateAppointmentStatus(id, status)
            toast.success(`Cita ${STATUS_LABELS[status] || status}`)
            fetchAppointments()
        } catch (e: any) {
            toast.error(e.message)
        }
    }

    useEffect(() => { setLoading(true); fetchAppointments() }, [filterBusinessId])

    if (loading) return <div className="flex items-center justify-center py-24"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>

    if (!filterBusinessId && isSuperAdmin) return (
        <div className="space-y-6"><h1 className="text-2xl font-bold">Citas</h1>
            <Card className="border-yellow-500/30 bg-yellow-500/5"><CardContent className="py-4 text-sm text-yellow-400 text-center">Selecciona un negocio para ver sus citas.</CardContent></Card>
        </div>
    )

    return (
        <div className="space-y-6">
            <div><h1 className="text-2xl font-bold tracking-tight">Citas</h1><p className="text-muted-foreground">Agenda y gestión de citas</p></div>

            {appointments.length === 0 ? (
                <Card className="border-border/50 bg-card/80"><CardContent className="py-12 text-center"><CalendarDays className="w-12 h-12 mx-auto text-muted-foreground/30 mb-4" /><p className="text-muted-foreground">No hay citas registradas.</p></CardContent></Card>
            ) : (
                <Card className="border-border/50 bg-card/80 backdrop-blur-sm"><CardContent className="p-0">
                    <table className="w-full text-sm">
                        <thead><tr className="border-b border-border/50">
                            <th className="text-left py-3 px-4 font-medium text-muted-foreground">Fecha</th>
                            <th className="text-left py-3 px-4 font-medium text-muted-foreground">Profesional</th>
                            <th className="text-left py-3 px-4 font-medium text-muted-foreground">Cliente</th>
                            <th className="text-right py-3 px-4 font-medium text-muted-foreground">Total</th>
                            <th className="text-center py-3 px-4 font-medium text-muted-foreground">Estado</th>
                            <th className="text-center py-3 px-4 font-medium text-muted-foreground">Acciones</th>
                        </tr></thead>
                        <tbody>{appointments.map(a => (
                            <tr key={a.id} className="border-b border-border/20 hover:bg-muted/30">
                                <td className="py-3 px-4 text-xs whitespace-nowrap">{new Date(a.starts_at).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
                                <td className="py-3 px-4">{a.professional?.first_name} {a.professional?.last_name}</td>
                                <td className="py-3 px-4 text-muted-foreground">{a.client?.first_name} {a.client?.last_name}</td>
                                <td className="py-3 px-4 text-right font-semibold">{format_currency(a.total_price)}</td>
                                <td className="py-3 px-4 text-center"><Badge className={`text-xs ${STATUS_COLORS[a.status] || ''}`}>{STATUS_LABELS[a.status] || a.status}</Badge></td>
                                <td className="py-3 px-4 text-center">
                                    <div className="flex gap-1 justify-center">
                                        {a.status === 'scheduled' && <><Button variant="ghost" size="sm" className="text-yellow-500" onClick={() => changeStatus(a.id, 'in_progress')} title="Iniciar"><Play className="w-3 h-3" /></Button><Button variant="ghost" size="sm" className="text-red-500" onClick={() => changeStatus(a.id, 'cancelled')} title="Cancelar"><X className="w-3 h-3" /></Button><Button variant="ghost" size="sm" className="text-gray-400" onClick={() => changeStatus(a.id, 'no_show')} title="No asistió"><UserX className="w-3 h-3" /></Button></>}
                                        {a.status === 'in_progress' && <Button variant="ghost" size="sm" className="text-green-500" onClick={() => changeStatus(a.id, 'completed')} title="Completar"><CheckCircle2 className="w-3 h-3" /></Button>}
                                        {a.status === 'completed' && <Button variant="outline" size="sm" className="border-emerald-500 text-emerald-500 hover:bg-emerald-500/10" onClick={() => openCheckoutModal(a)}><Receipt className="w-4 h-4 mr-2" />Cobrar / Check-out</Button>}
                                    </div>
                                </td>
                            </tr>
                        ))}</tbody>
                    </table>
                </CardContent></Card>
            )}

            <Dialog open={isCheckoutOpen} onOpenChange={setIsCheckoutOpen}>
                <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-emerald-500"><Receipt className="w-6 h-6" /> Check-out de Cita</DialogTitle>
                    </DialogHeader>
                    
                    {selectedAppt && (
                        <div className="space-y-6 py-4">
                            <div className="flex justify-between items-start bg-muted/30 p-4 rounded-lg border border-border/50">
                                <div className="space-y-1">
                                    <div className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Cliente</div>
                                    <div className="font-semibold">{selectedAppt.client?.first_name} {selectedAppt.client?.last_name}</div>
                                </div>
                                <div className="space-y-1 text-right">
                                    <div className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Profesional</div>
                                    <div className="font-semibold">{selectedAppt.professional?.first_name} {selectedAppt.professional?.last_name}</div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-4">
                                    <h3 className="font-bold flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> Servicios Realizados</h3>
                                    <div className="space-y-2">
                                        {selectedAppt.services.map((s, idx) => (
                                            <div key={idx} className="flex justify-between text-sm py-1 border-b border-border/10 last:border-0 italic text-muted-foreground">
                                                <span>{(s.name as any)?.name || 'Servicio'}</span>
                                                <span className="font-mono">{format_currency(s.price)}</span>
                                            </div>
                                        ))}
                                        <div className="flex justify-between pt-2 font-bold text-emerald-500">
                                            <span>Subtotal Servicios</span>
                                            <span>{format_currency(selectedAppt.total_price)}</span>
                                        </div>
                                    </div>

                                    <Separator className="my-4" />

                                    <h3 className="font-bold flex items-center gap-2"><ShoppingCart className="w-4 h-4 text-brand" /> Upselling (Productos)</h3>
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                        <Input 
                                            placeholder="Buscar productos en inventario..." 
                                            className="pl-10"
                                            value={productSearch}
                                            onChange={e => setProductSearch(e.target.value)}
                                        />
                                        {productSearch && (
                                            <div className="absolute top-full left-0 right-0 bg-popover border border-border rounded-md shadow-xl z-50 mt-1 max-h-48 overflow-y-auto">
                                                {productsList.filter(p => p.name.toLowerCase().includes(productSearch.toLowerCase())).map(p => (
                                                    <div 
                                                        key={p.id} 
                                                        className="p-2 hover:bg-muted cursor-pointer flex justify-between items-center text-sm"
                                                        onClick={() => addProductToCheckout(p)}
                                                    >
                                                        <span>{p.name} <span className="text-[10px] text-muted-foreground">({p.stock_qty} en stock)</span></span>
                                                        <span className="text-brand font-bold">{format_currency(p.cost_per_unit * 1.5)}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    <div className="space-y-2 mt-4">
                                        {extraProducts.length === 0 && <p className="text-xs text-center text-muted-foreground py-4 border-2 border-dashed rounded-lg">No se han añadido productos adicionales.</p>}
                                        {extraProducts.map(p => (
                                            <div key={p.product_id} className="flex items-center gap-3 p-2 bg-brand/5 rounded-md border border-brand/10">
                                                <div className="flex-1 text-sm font-medium">{p.name}</div>
                                                <div className="flex items-center gap-2">
                                                    <Input 
                                                        type="number" 
                                                        value={p.qty} 
                                                        className="h-7 w-16 text-right" 
                                                        onChange={e => updateProductQty(p.product_id, Number(e.target.value))}
                                                    />
                                                    <Button variant="ghost" size="sm" className="h-7 w-7 text-red-500" onClick={() => removeProductFromCheckout(p.product_id)}><Trash2 className="w-3 h-3" /></Button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="space-y-6">
                                    <h3 className="font-bold flex items-center gap-2">📦 Totalización y Pago</h3>
                                    
                                    <div className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-xl space-y-2">
                                        <div className="flex justify-between text-sm">
                                            <span>Servicios</span>
                                            <span>{format_currency(selectedAppt.total_price)}</span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span>Productos</span>
                                            <span>{format_currency(extraProducts.reduce((a,c) => a + (c.qty * c.price), 0))}</span>
                                        </div>
                                        <Separator className="my-2 bg-emerald-500/20" />
                                        <div className="flex justify-between text-xl font-bold text-emerald-500">
                                            <span>TOTAL FINAL</span>
                                            <span>{format_currency(selectedAppt.total_price + extraProducts.reduce((a,c) => a + (c.qty * c.price), 0))}</span>
                                        </div>
                                    </div>

                                    <div className="space-y-4 pt-4 border-t border-border/50">
                                        <div className="space-y-2">
                                            <Label className="flex items-center gap-2"><DollarSign className="w-4 h-4" /> Medio de Pago (Cuenta)</Label>
                                            <Select value={selectedAccountId} onValueChange={(v: string | null) => setSelectedAccountId(v || '')}>
                                                <SelectTrigger className="w-full">
                                                    <SelectValue placeholder="Selecciona la cuenta destino" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {accountsList.map(acc => (
                                                        <SelectItem key={acc.id} value={acc.id}>{acc.name} ({format_currency(acc.balance)})</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        {!openRegister && (
                                            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start gap-3 text-red-500">
                                                <AlertCircle className="w-5 h-5 shrink-0" />
                                                <div className="space-y-1">
                                                    <div className="font-bold text-sm">Caja Cerrada</div>
                                                    <p className="text-[10px] leading-tight text-red-400">Debes abrir caja en el módulo financiero para procesar pagos en esta sede.</p>
                                                </div>
                                            </div>
                                        )}

                                        {openRegister && (
                                            <div className="p-3 bg-emerald-500/5 border border-emerald-500/10 rounded-lg flex items-center gap-3 text-emerald-500 text-xs italic">
                                                <MapPin className="w-4 h-4" />
                                                Ingreso registrado en Caja Abierta de {activeLocationName}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    <DialogFooter className="bg-muted/50 -mx-6 -mb-6 p-6">
                        <Button variant="ghost" disabled={isProcessing} onClick={() => setIsCheckoutOpen(false)}>Cancelar</Button>
                        <Button 
                            className="gradient-brand text-white px-8" 
                            disabled={!openRegister || !selectedAccountId || isProcessing}
                            onClick={handleCheckout}
                        >
                            {isProcessing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Receipt className="w-4 h-4 mr-2" />}
                            Procesar Pago & Aprobar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
