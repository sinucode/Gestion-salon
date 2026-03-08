import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CalendarDays, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function AppointmentsPage() {
    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Citas</h1>
                    <p className="text-muted-foreground">Agenda, citas express y aprobaciones</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline">
                        <Plus className="w-4 h-4 mr-2" />
                        Cita Express
                    </Button>
                    <Button className="gradient-brand text-white">
                        <Plus className="w-4 h-4 mr-2" />
                        Nueva Cita
                    </Button>
                </div>
            </div>
            <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <CalendarDays className="w-5 h-5" />
                        Calendario de Citas
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-muted-foreground text-center py-12">
                        Conecta Supabase para ver el calendario de citas.
                    </p>
                </CardContent>
            </Card>
        </div>
    )
}
