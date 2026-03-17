'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { StatCard } from '@/components/dashboard/StatCard';
import { Package, AlertTriangle, CheckCircle, ShoppingCart, RefreshCw, Bell, Loader2 } from 'lucide-react';

interface InventoryItem {
  id: string;
  category: string;
  item: string;
  qty: number;
  unit: string;
  threshold_warn: number;
  threshold_crit: number;
  reorder_qty: number;
  projected_use?: number;
  supplier_url?: string;
}

const CATEGORIES = ['All', 'Vaccines', 'Surgical', 'Medications', 'Diagnostics', 'Injectables', 'Skincare', 'Laser'];

const MOCK_INVENTORY: InventoryItem[] = [
  { id: '1', category: 'Vaccines', item: 'Rabies vaccine', qty: 8, threshold_warn: 25, threshold_crit: 10, unit: 'doses', reorder_qty: 50, projected_use: 6 },
  { id: '2', category: 'Vaccines', item: 'DHPP vaccine', qty: 30, threshold_warn: 25, threshold_crit: 10, unit: 'doses', reorder_qty: 50, projected_use: 6 },
  { id: '3', category: 'Vaccines', item: 'Bordetella', qty: 45, threshold_warn: 20, threshold_crit: 8, unit: 'doses', reorder_qty: 40, projected_use: 3 },
  { id: '4', category: 'Surgical', item: 'Suture packs (3-0 Vicryl)', qty: 4, threshold_warn: 15, threshold_crit: 5, unit: 'packs', reorder_qty: 20, projected_use: 4 },
  { id: '5', category: 'Surgical', item: 'IV fluids (1L bags)', qty: 6, threshold_warn: 12, threshold_crit: 5, unit: 'bags', reorder_qty: 24, projected_use: 4 },
  { id: '6', category: 'Surgical', item: 'Surgical gloves', qty: 40, threshold_warn: 20, threshold_crit: 8, unit: 'pairs', reorder_qty: 50, projected_use: 8 },
  { id: '7', category: 'Medications', item: 'Apoquel', qty: 200, threshold_warn: 50, threshold_crit: 20, unit: 'tablets', reorder_qty: 100, projected_use: 20 },
  { id: '8', category: 'Medications', item: 'Carprofen', qty: 12, threshold_warn: 30, threshold_crit: 10, unit: 'tablets', reorder_qty: 60, projected_use: 15 },
  { id: '9', category: 'Diagnostics', item: 'Heartworm test kits', qty: 22, threshold_warn: 20, threshold_crit: 8, unit: 'kits', reorder_qty: 30, projected_use: 5 },
  { id: '10', category: 'Diagnostics', item: 'Parvo test kits', qty: 7, threshold_warn: 15, threshold_crit: 5, unit: 'kits', reorder_qty: 20, projected_use: 2 },
  { id: '11', category: 'Injectables', item: 'Botox (50u vials)', qty: 3, threshold_warn: 10, threshold_crit: 4, unit: 'vials', reorder_qty: 15, projected_use: 2 },
  { id: '12', category: 'Injectables', item: 'Juvederm Ultra (1ml)', qty: 8, threshold_warn: 12, threshold_crit: 4, unit: 'syringes', reorder_qty: 20, projected_use: 3 },
  { id: '13', category: 'Skincare', item: 'SkinMedica HA5 Serum', qty: 5, threshold_warn: 8, threshold_crit: 2, unit: 'bottles', reorder_qty: 12, projected_use: 1 },
  { id: '14', category: 'Laser', item: 'IPL treatment tips', qty: 2, threshold_warn: 6, threshold_crit: 2, unit: 'tips', reorder_qty: 10, projected_use: 2 },
];

function getSeverity(item: InventoryItem): 'critical' | 'warning' | 'healthy' {
  const after = item.qty - (item.projected_use || 0);
  if (after <= item.threshold_crit) return 'critical';
  if (after <= item.threshold_warn) return 'warning';
  return 'healthy';
}

function StockBar({ qty, warn, crit }: { qty: number; warn: number; crit: number }) {
  const max = Math.max(qty, warn * 1.5);
  const pct = Math.min((qty / max) * 100, 100);
  const color = qty <= crit ? 'bg-red-500' : qty <= warn ? 'bg-amber-500' : 'bg-emerald-500';
  return (
    <div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden">
      <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export default function InventoryPage() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [filter, setFilter] = useState('All');
  const [loading, setLoading] = useState(true);
  const [reordering, setReordering] = useState<string | null>(null);
  const [alertSending, setAlertSending] = useState(false);
  const [alertSent, setAlertSent] = useState(false);
  const [usingMock, setUsingMock] = useState(false);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/inventory/items');
      const data = await res.json();
      if (data.items && data.items.length > 0) {
        setItems(data.items);
        setUsingMock(false);
      } else {
        setItems(MOCK_INVENTORY);
        setUsingMock(true);
      }
    } catch {
      setItems(MOCK_INVENTORY);
      setUsingMock(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const handleReorder = async (item: InventoryItem) => {
    setReordering(item.id);
    try {
      const res = await fetch('/api/inventory/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: item.id, action: 'reorder' }),
      });
      if (res.ok) {
        const { item: updated } = await res.json();
        setItems(prev => prev.map(i => i.id === item.id ? { ...i, qty: updated?.qty ?? i.qty + i.reorder_qty } : i));
      } else {
        setItems(prev => prev.map(i => i.id === item.id ? { ...i, qty: i.qty + i.reorder_qty } : i));
      }
    } finally {
      setReordering(null);
    }
  };

  const handleSendAlert = async () => {
    setAlertSending(true);
    const alertItems = items
      .filter(i => getSeverity(i) !== 'healthy')
      .map(i => ({ name: i.item, qty: i.qty, unit: i.unit, severity: getSeverity(i) }));
    try {
      await fetch('/api/inventory/alert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: alertItems }),
      });
      setAlertSent(true);
      setTimeout(() => setAlertSent(false), 3000);
    } finally {
      setAlertSending(false);
    }
  };

  const filtered = filter === 'All' ? items : items.filter(i => i.category === filter);
  const critical = items.filter(i => getSeverity(i) === 'critical').length;
  const warning = items.filter(i => getSeverity(i) === 'warning').length;
  const healthy = items.filter(i => getSeverity(i) === 'healthy').length;
  const activeCategories = ['All', ...Array.from(new Set(items.map(i => i.category)))];
  const displayCategories = CATEGORIES.filter(c => activeCategories.includes(c));

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Inventory Brain</h1>
          <p className="text-sm text-muted-foreground mt-1">
            AI-forecasted stock levels based on today&apos;s appointment schedule
          </p>
          {usingMock && (
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
              ⚡ Demo mode — run migration 008 in Supabase for live inventory
            </p>
          )}
        </div>
        <div className="flex gap-2">
          {(critical + warning) > 0 && (
            <Button
              variant="outline"
              onClick={handleSendAlert}
              disabled={alertSending || alertSent}
              className={`gap-2 ${alertSent ? 'text-emerald-600 border-emerald-400' : 'text-amber-600 border-amber-300 hover:bg-amber-50'}`}
            >
              {alertSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bell className="h-4 w-4" />}
              {alertSent ? 'Alert Sent!' : `Send Stock Alert (${critical + warning})`}
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={fetchItems} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard title="Total Items" value={items.length} icon={Package} variant="info" />
        <StatCard title="Critical" value={critical} icon={AlertTriangle} variant="danger" subtitle="Order immediately" />
        <StatCard title="Warning" value={warning} icon={AlertTriangle} variant="warning" subtitle="Order within 2 days" />
        <StatCard title="Healthy" value={healthy} icon={CheckCircle} variant="success" />
      </div>

      {/* Category Filter */}
      <div className="flex gap-2 flex-wrap">
        {displayCategories.map(cat => (
          <Button
            key={cat}
            variant={filter === cat ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter(cat)}
            className="h-8 text-xs"
          >
            {cat}
          </Button>
        ))}
      </div>

      {/* Inventory Table */}
      <Card className="bg-white/70 dark:bg-gray-800/50 backdrop-blur-xl border-white/20 dark:border-gray-700/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Stock Levels</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading inventory...
            </div>
          ) : (
            <div className="divide-y divide-border">
              {/* Header row */}
              <div className="grid grid-cols-12 gap-4 px-6 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                <div className="col-span-3">Item</div>
                <div className="col-span-2">Category</div>
                <div className="col-span-1 text-right">In Stock</div>
                <div className="col-span-1 text-right">Projected Use</div>
                <div className="col-span-1 text-right">After Today</div>
                <div className="col-span-2">Level</div>
                <div className="col-span-1">Status</div>
                <div className="col-span-1 text-right">Action</div>
              </div>

              {filtered.map((item) => {
                const severity = getSeverity(item);
                const afterToday = item.qty - (item.projected_use || 0);
                return (
                  <div
                    key={item.id}
                    className={`grid grid-cols-12 gap-4 px-6 py-3.5 items-center hover:bg-muted/30 transition-colors ${
                      severity === 'critical' ? 'bg-red-50/50 dark:bg-red-950/10' :
                      severity === 'warning' ? 'bg-amber-50/50 dark:bg-amber-950/10' : ''
                    }`}
                  >
                    <div className="col-span-3">
                      <p className="text-sm font-medium">{item.item}</p>
                    </div>
                    <div className="col-span-2">
                      <span className="text-xs text-muted-foreground">{item.category}</span>
                    </div>
                    <div className="col-span-1 text-right">
                      <span className="text-sm font-semibold">{item.qty}</span>
                      <span className="text-xs text-muted-foreground ml-1">{item.unit}</span>
                    </div>
                    <div className="col-span-1 text-right">
                      <span className="text-sm text-muted-foreground">-{item.projected_use || 0}</span>
                    </div>
                    <div className="col-span-1 text-right">
                      <span className={`text-sm font-medium ${
                        afterToday <= item.threshold_crit ? 'text-red-600 dark:text-red-400' :
                        afterToday <= item.threshold_warn ? 'text-amber-600 dark:text-amber-400' :
                        'text-emerald-600 dark:text-emerald-400'
                      }`}>{Math.max(0, afterToday)}</span>
                    </div>
                    <div className="col-span-2">
                      <StockBar qty={item.qty} warn={item.threshold_warn} crit={item.threshold_crit} />
                    </div>
                    <div className="col-span-1">
                      {severity === 'critical' && (
                        <Badge className="text-xs border-0 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">Critical</Badge>
                      )}
                      {severity === 'warning' && (
                        <Badge className="text-xs border-0 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">Warning</Badge>
                      )}
                      {severity === 'healthy' && (
                        <Badge className="text-xs border-0 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">OK</Badge>
                      )}
                    </div>
                    <div className="col-span-1 text-right">
                      {severity !== 'healthy' && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs gap-1"
                          onClick={() => handleReorder(item)}
                          disabled={reordering === item.id}
                        >
                          {reordering === item.id
                            ? <RefreshCw className="h-3 w-3 animate-spin" />
                            : <ShoppingCart className="h-3 w-3" />
                          }
                          Reorder
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}

              {filtered.length === 0 && (
                <div className="text-center py-10 text-sm text-muted-foreground">
                  No {filter !== 'All' ? filter : ''} items found.
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
