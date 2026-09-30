import { Bot, Car, CreditCard, FileText, HeartPulse, Home, MapPin, PiggyBank, Plane, Smartphone, Umbrella, Users } from 'lucide-react'
import type { Bron, Domein } from '../types'

export const BRON_ICON: Record<Bron, typeof Bot> = {
  EIGEN_AI: Bot, DOCCLE: FileText, GEOFENCE: MapPin, APP: Smartphone, REKENING: CreditCard,
}

export const DOMEIN_ICON: Record<Domein, typeof Bot> = {
  huis: Home, gezin: Users, auto: Car, bescherming: Umbrella, sparen: PiggyBank, gezondheid: HeartPulse, reizen: Plane,
}
