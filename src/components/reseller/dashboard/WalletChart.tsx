import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface ChartData {
  month: string;
  credit: number;
  debit: number;
}

export default function WalletChart({ data }: { data: ChartData[] }) {
  return (
    <Card className="lg:col-span-2">
      <CardHeader><CardTitle className="text-base">Wallet Activity (Last 6 Months)</CardTitle></CardHeader>
      <CardContent>
        {data.length > 0 ? (
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" fontSize={12} stroke="hsl(var(--muted-foreground))" />
              <YAxis fontSize={12} stroke="hsl(var(--muted-foreground))" />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
              <Bar dataKey="credit" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Credit" />
              <Bar dataKey="debit" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} name="Debit" />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-center text-muted-foreground py-8">No transaction data yet</p>
        )}
      </CardContent>
    </Card>
  );
}
