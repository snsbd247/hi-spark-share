import { useState, useCallback, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { MapPin, LocateFixed, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix default marker icon
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

function MapClickHandler({ onSelect }: { onSelect: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onSelect(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function FlyToLocation({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    if (lat && lng) map.flyTo([lat, lng], 15, { duration: 1 });
  }, [lat, lng, map]);
  return null;
}

interface MapLocationPickerProps {
  lat?: number;
  lng?: number;
  onSelect: (lat: number, lng: number) => void;
}

export function MapLocationPicker({ lat, lng, onSelect }: MapLocationPickerProps) {
  const [open, setOpen] = useState(false);
  const [pickedLat, setPickedLat] = useState<number>(lat || 23.8103);
  const [pickedLng, setPickedLng] = useState<number>(lng || 90.4125);
  const [hasPin, setHasPin] = useState(!!(lat && lng));
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (lat && lng) {
      setPickedLat(lat);
      setPickedLng(lng);
      setHasPin(true);
    }
  }, [lat, lng]);

  const handleMapClick = useCallback((lat: number, lng: number) => {
    setPickedLat(lat);
    setPickedLng(lng);
    setHasPin(true);
  }, []);

  const handleConfirm = () => {
    onSelect(pickedLat, pickedLng);
    setOpen(false);
  };

  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPickedLat(pos.coords.latitude);
        setPickedLng(pos.coords.longitude);
        setHasPin(true);
      },
      () => {},
      { enableHighAccuracy: true }
    );
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=1`
      );
      const data = await res.json();
      if (data.length > 0) {
        const { lat, lon } = data[0];
        setPickedLat(parseFloat(lat));
        setPickedLng(parseFloat(lon));
        setHasPin(true);
      }
    } catch {}
    setSearching(false);
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-1.5"
        onClick={() => setOpen(true)}
      >
        <MapPin className="h-4 w-4 text-primary" />
        {lat && lng ? `${lat.toFixed(4)}, ${lng.toFixed(4)}` : "লোকেশন নির্বাচন"}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-primary" /> ম্যাপ থেকে লোকেশন নির্বাচন করুন
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            {/* Search bar */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="জায়গার নাম লিখুন..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  className="pl-8"
                />
              </div>
              <Button variant="outline" size="sm" onClick={handleSearch} disabled={searching}>
                {searching ? "..." : "খুঁজুন"}
              </Button>
              <Button variant="outline" size="icon" onClick={handleGetCurrentLocation} title="বর্তমান লোকেশন">
                <LocateFixed className="h-4 w-4" />
              </Button>
            </div>

            {/* Map */}
            <div className="h-[350px] rounded-lg overflow-hidden border border-border">
              <MapContainer
                center={[pickedLat, pickedLng]}
                zoom={hasPin ? 15 : 7}
                style={{ height: "100%", width: "100%" }}
                scrollWheelZoom
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <MapClickHandler onSelect={handleMapClick} />
                {hasPin && <Marker position={[pickedLat, pickedLng]} />}
                {hasPin && <FlyToLocation lat={pickedLat} lng={pickedLng} />}
              </MapContainer>
            </div>

            {/* Coordinates display */}
            {hasPin && (
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span>Lat: <strong className="text-foreground">{pickedLat.toFixed(6)}</strong></span>
                <span>Lng: <strong className="text-foreground">{pickedLng.toFixed(6)}</strong></span>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>বাতিল</Button>
            <Button onClick={handleConfirm} disabled={!hasPin}>
              <MapPin className="h-4 w-4 mr-1" /> নিশ্চিত করুন
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
