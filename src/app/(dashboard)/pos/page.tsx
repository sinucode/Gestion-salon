'use client'

import { useEffect, useState, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Plus, Minus, Trash2, ShoppingCart, Loader2, Printer, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores'
import { toast } from 'sonner'
import { formatCOP } from '@/lib/utils/currency'
import { process_direct_sale, create_express_appointment } from '@/actions/pos'

interface ProductItem { id: string; name: string; sell_price: number; stock_qty: number; type: 'product' }
interface ServiceItem { id: string; name: string; price: number; type: 'service' }
interface CartItem { id: string; name: string; price: number; qty: number; type: 'product' | 'service' }

export default function POSPage() {
    const { user, selectedBusinessId } = useAuthStore()
    const isSuperAdmin = user?.role === 'super_admin'
    const filterBusinessId = isSuperAdmin ? selectedBusinessId : user?.business_id

    const [products, setProducts] = useState<ProductItem[]>([])
    const [services, setServices] = useState<ServiceItem[]>([])
    const [professionals, setProfessionals] = useState<{ id: string; name: string }[]>([])
    const [accounts, setAccounts] = useState<{ id: string; name: string }[]>([])
    const [activeRegister, setActiveRegister] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)

    // Form states
    const [cart, setCart] = useState<CartItem[]>([])
    const [clientName, setClientName] = useState('')
    const [selectedProf, setSelectedProf] = useState('')
    const [selectedAccount, setSelectedAccount] = useState('')
    const [processing, setProcessing] = useState(false)
    const [receiptData, setReceiptData] = useState<any>(null)

    const fetchData = async () => {
        if (!filterBusinessId) { setLoading(false); return }
        const supabase = createClient()
        const [
            { data: prods },
            { data: svcs },
            { data: profs },
            { data: accs },
            { data: reg }
        ] = await Promise.all([
            supabase.from('products').select('id, name, sell_price, stock_qty').eq('business_id', filterBusinessId).eq('is_active', true),
            supabase.from('services').select('id, name, price').eq('business_id', filterBusinessId).eq('is_active', true),
            supabase.from('profiles').select('id, first_name, last_name').eq('business_id', filterBusinessId).eq('role', 'professional').eq('is_active', true),
            supabase.from('accounts').select('id, name').eq('business_id', filterBusinessId).eq('is_active', true),
            supabase.from('cash_registers').select('id').eq('business_id', filterBusinessId).eq('status', 'open').order('created_at', { ascending: false }).limit(1)
        ])

        if (prods) setProducts(prods.map(p => ({ ...p, type: 'product' })))
        if (svcs) setServices(svcs.map(s => ({ ...s, type: 'service' })))
        if (profs) setProfessionals(profs.map(p => ({ id: p.id, name: `${p.first_name} ${p.last_name}` })))
        if (accs) {
            setAccounts(accs)
            if (accs.length > 0) setSelectedAccount(accs[0].id)
        }
        if (reg && reg.length > 0) setActiveRegister(reg[0].id)

        setLoading(false)
    }

    useEffect(() => { setLoading(true); fetchData() }, [filterBusinessId])

    const addToCart = (item: ProductItem | ServiceItem) => {
        const itemPrice = item.type === 'product' ? (item as ProductItem).sell_price : (item as ServiceItem).price
        setCart(prev => {
            const ext = prev.find(i => i.id === item.id)
            if (ext) return prev.map(i => i.id === item.id ? { ...i, qty: i.qty + 1 } : i)
            return [...prev, { id: item.id, name: item.name, price: itemPrice, qty: 1, type: item.type }]
        })
    }

    const updateQty = (id: string, delta: number) => {
        setCart(prev => prev.map(i => {
            if (i.id === id) {
                const newQty = i.qty + delta
                return newQty > 0 ? { ...i, qty: newQty } : i
            }
            return i
        }))
    }

    const removeItem = (id: string) => setCart(prev => prev.filter(i => i.id !== id))
    
    const cartTotal = cart.reduce((acc, i) => acc + (i.price * i.qty), 0)
    const hasProducts = cart.some(i => i.type === 'product')
    const hasServices = cart.some(i => i.type === 'service')

    const processSale = async () => {
        if (cart.length === 0) return
        if (hasProducts && !activeRegister) return toast.error('Debes abrir caja para facturar productos.')
        if (hasProducts && !selectedAccount) return toast.error('Selecciona una cuenta de recaudo.')
        if (hasServices && !selectedProf) return toast.error('Selecciona un profesional para el servicio.')
        if (hasServices && !clientName) return toast.error('Escribe el nombre del cliente.')

        setProcessing(true)
        try {
            // 1. Process services if any (Express Appointment)
            if (hasServices) {
                await create_express_appointment({
                    business_id: filterBusinessId!,
                    location_id: user!.location_id!,
                    professional_id: selectedProf,
                    client_name: clientName,
                    service_ids: cart.filter(i => i.type === 'service').map(i => i.id),
                    total: cart.filter(i => i.type === 'service').reduce((acc, i) => acc + (i.price * i.qty), 0)
                })
            }

            // 2. Process products if any (Direct Sale)
            if (hasProducts) {
                await process_direct_sale({
                    business_id: filterBusinessId!,
                    location_id: user!.location_id!,
                    cash_register_id: activeRegister!,
                    account_id: selectedAccount,
                    items: cart.filter(i => i.type === 'product').map(i => ({ product_id: i.id, qty: i.qty, price: i.price })),
                    total: cart.filter(i => i.type === 'product').reduce((acc, i) => acc + (i.price * i.qty), 0),
                    client_name: clientName
                })
            }

            toast.success('Check-out procesado exitosamente')
            setReceiptData({ items: cart, total: cartTotal, client: clientName, date: new Date().toISOString() })
            setCart([])
            setClientName('')
        } catch (error: any) {
            toast.error(error.message || 'Error procesando la venta')
        }
        setProcessing(false)
    }

    const printReceipt = () => {
        window.print()
    }

    if (loading) return <div className="flex justify-center items-center py-24"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>

    if (!filterBusinessId) return (
        <Card className="border-yellow-500/30 bg-yellow-500/5"><CardContent className="py-4 text-center text-yellow-400">Selecciona un negocio para usar el punto de venta (POS).</CardContent></Card>
    )

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold tracking-tight hide-on-print">Punto de Venta Expreso (POS)</h1>
            {!activeRegister && (
                <div className="bg-red-500/10 text-red-500 border border-red-500/30 p-3 rounded-md text-sm hide-on-print">
                    ⚠️ <strong>Caja cerrada:</strong> No has abierto base para esta sede. Requieres abrir caja en el módulo Financiero para procesar ventas de productos.
                </div>
            )}

            {/* Print Section */}
            {receiptData && (
                <div className="hidden print:block text-black print-container font-mono text-sm leading-tight p-2 w-[80mm] mx-auto absolute top-0 left-0 bg-white">
                    <h2 className="text-center font-bold text-lg mb-2">COMPROBANTE</h2>
                    <p className="text-center text-xs mb-4">{new Date(receiptData.date).toLocaleString('es-CO')}</p>
                    {receiptData.client && <p className="mb-2">Cliente: {receiptData.client}</p>}
                    <div className="border-t border-b border-black py-2 mb-2">
                        {receiptData.items.map((it: any, i: number) => (
                            <div key={i} className="flex justify-between items-center mb-1">
                                <span className="flex-1 truncate pr-2">{it.qty}x {it.name.substring(0, 15)}</span>
                                <span className="font-semibold">{formatCOP(it.price * it.qty)}</span>
                            </div>
                        ))}
                    </div>
                    <div className="flex justify-between items-center font-bold text-lg">
                        <span>TOTAL</span>
                        <span>{formatCOP(receiptData.total)}</span>
                    </div>
                    <p className="text-center text-xs mt-6">¡Gracias por tu visita!</p>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 hide-on-print">
                {/* Catalog / Selection */}
                <div className="lg:col-span-2 space-y-4">
                    <Tabs defaultValue="services" className="w-full">
                        <TabsList className="w-full">
                            <TabsTrigger value="services" className="flex-1">Servicios Estéticos</TabsTrigger>
                            <TabsTrigger value="products" className="flex-1">Venta Productos</TabsTrigger>
                        </TabsList>
                        <TabsContent value="services" className="pt-2">
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                {services.map(s => (
                                    <Card key={s.id} className="cursor-pointer hover:border-brand transition-colors" onClick={() => addToCart(s)}>
                                        <CardContent className="p-3 text-center">
                                            <p className="font-medium text-sm line-clamp-2 min-h-[40px]">{s.name}</p>
                                            <Badge variant="outline" className="mt-2 text-brand font-semibold">{formatCOP(s.price)}</Badge>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        </TabsContent>
                        <TabsContent value="products" className="pt-2">
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                {products.map(p => (
                                    <Card key={p.id} className={`cursor-pointer transition-colors ${p.stock_qty > 0 ? 'hover:border-green-500' : 'opacity-50 grayscale'}`} onClick={() => p.stock_qty > 0 && addToCart(p)}>
                                        <CardContent className="p-3 text-center">
                                            <p className="font-medium text-sm line-clamp-2 min-h-[40px]">{p.name}</p>
                                            <div className="flex items-center justify-between mt-2">
                                                <span className="text-xs text-muted-foreground font-mono">Stock: {p.stock_qty}</span>
                                                <Badge className="bg-green-500 hover:bg-green-600 font-semibold">{formatCOP(p.sell_price)}</Badge>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        </TabsContent>
                    </Tabs>
                </div>

                {/* Cart & Checkout */}
                <Card className="border-border/50 bg-card/80 backdrop-blur-sm self-start sticky top-20">
                    <CardHeader className="bg-muted/30 border-b border-border/50 pb-3">
                        <CardTitle className="text-lg flex items-center justify-between">
                            <span className="flex items-center gap-2"><ShoppingCart className="w-5 h-5" /> Orden</span>
                            <Badge variant="secondary">{cart.length} items</Badge>
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 space-y-4">
                        {cart.length === 0 ? (
                            <p className="text-center text-muted-foreground text-sm py-8">La canasta está vacía</p>
                        ) : (
                            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                                {cart.map(c => (
                                    <div key={c.id} className="flex flex-col gap-1 border-b border-border/30 pb-2 mb-2">
                                        <div className="flex justify-between items-start">
                                            <span className="text-sm font-medium line-clamp-1 flex-1">{c.name}</span>
                                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-red-500" onClick={() => removeItem(c.id)}><Trash2 className="w-3 h-3" /></Button>
                                        </div>
                                        <div className="flex justify-between items-center bg-muted/20 p-1 rounded">
                                            <div className="flex items-center gap-2">
                                                <Button variant="outline" size="sm" className="h-6 w-6 p-0" onClick={() => updateQty(c.id, -1)}><Minus className="w-3 h-3" /></Button>
                                                <span className="text-xs font-mono w-4 text-center">{c.qty}</span>
                                                {c.type === 'product' && <Button variant="outline" size="sm" className="h-6 w-6 p-0" onClick={() => updateQty(c.id, 1)}><Plus className="w-3 h-3" /></Button>}
                                            </div>
                                            <span className="font-semibold text-sm">{formatCOP(c.price * c.qty)}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="bg-background rounded-lg border border-border/50 p-3 space-y-3">
                            <div className="flex justify-between items-center font-bold text-lg">
                                <span>TOTAL</span>
                                <span className={hasProducts ? 'text-green-500' : 'text-brand'}>{formatCOP(cartTotal)}</span>
                            </div>

                            {hasServices && (
                                <div className="space-y-2 pt-2 border-t border-border/50">
                                    <Select value={selectedProf} onValueChange={setSelectedProf}>
                                        <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Asignar a..." /></SelectTrigger>
                                        <SelectContent>
                                            {professionals.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                    <Input placeholder="Nombre del cliente exprés" className="h-8 text-xs" value={clientName} onChange={e => setClientName(e.target.value)} />
                                </div>
                            )}

                            {hasProducts && (
                                <div className="space-y-2 pt-2 border-t border-border/50">
                                    <Select value={selectedAccount} onValueChange={setSelectedAccount}>
                                        <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Cuenta de pago..." /></SelectTrigger>
                                        <SelectContent>
                                            {accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}
                        </div>

                        <div className="pt-2 grid gap-2">
                            <Button className="w-full gradient-brand text-white shadow-md hover:shadow-lg transition-all" size="lg" disabled={cart.length === 0 || processing || (hasProducts && !activeRegister)} onClick={processSale}>
                                {processing ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Procesando...</> : <><CheckCircle2 className="w-4 h-4 mr-2" /> Cobrar {formatCOP(cartTotal)}</>}
                            </Button>

                            {receiptData && (
                                <Button variant="outline" className="w-full border-brand/50 text-brand" onClick={printReceipt}>
                                    <Printer className="w-4 h-4 mr-2" /> Imprimir Tirilla
                                </Button>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>
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
