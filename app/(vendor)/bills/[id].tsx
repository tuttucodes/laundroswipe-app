import { useMemo } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft, Edit3, FileDown, Printer, Trash2 } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useQuery } from '@tanstack/react-query';
import { VendorApi } from '@/lib/vendor-api';
import { queryClient } from '@/lib/query-client';
import { useBluetoothPrinter } from '@/hooks/use-bluetooth-printer';
import {
  buildVendorReceiptEscPos,
  savedVendorBillToReceiptInput,
} from '@/lib/printing/receipt/vendorReceipt';
import { shareBillPdf } from '@/lib/printing/share-pdf';
import type { VendorBillRow } from '@/lib/api';

export default function VendorBillDetail() {
  const router = useRouter();
  const { id, token } = useLocalSearchParams<{ id: string; token: string }>();
  const printer = useBluetoothPrinter();

  const lookupQuery = useQuery({
    queryKey: ['vendor-lookup', token],
    enabled: !!token,
    queryFn: () => VendorApi.lookup(String(token)),
  });

  const billsQuery = useQuery({
    queryKey: ['vendor-bills'],
    queryFn: () => VendorApi.bills({ page: 1, limit: 50 }),
    staleTime: 30_000,
  });

  const row = useMemo(
    () => (billsQuery.data?.bills ?? []).find((b) => b.id === id) ?? null,
    [billsQuery.data, id],
  );

  const detail: VendorBillRow | null = useMemo(() => {
    if (!row) return null;
    const latest = lookupQuery.data?.latest_bill;
    return {
      ...row,
      line_items: latest?.id === row.id ? (latest?.line_items ?? []) : [],
    };
  }, [row, lookupQuery.data]);

  const printBluetooth = async () => {
    if (!detail) return;
    if (!printer.prefs?.mac) {
      Alert.alert('No printer', 'Open Printer settings to pick a paired printer first.');
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
    const input = savedVendorBillToReceiptInput(detail);
    const bytes = buildVendorReceiptEscPos(printer.prefs.paper, input);
    const r = await printer.print(bytes);
    if (!r.ok) Alert.alert('Print failed', r.error);
    else Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
  };

  const exportPdf = async () => {
    if (!detail) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    const r = await shareBillPdf(detail);
    if (!r.ok) Alert.alert('Share failed', r.error);
  };

  const remove = () => {
    if (!detail) return;
    Alert.alert(
      'Delete bill?',
      `This cancels bill #${detail.order_token}. Customer will see it as cancelled.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await VendorApi.cancelBill(detail.id);
              await queryClient.invalidateQueries({ queryKey: ['vendor-bills'] });
              await queryClient.invalidateQueries({ queryKey: ['vendor-bills-recent'] });
              await queryClient.invalidateQueries({ queryKey: ['vendor-revenue-today'] });
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(
                () => undefined,
              );
              router.back();
            } catch (e) {
              Alert.alert('Delete failed', (e as Error).message);
            }
          },
        },
      ],
    );
  };

  const edit = () => {
    if (!detail) return;
    router.push({ pathname: '/(vendor)/bill-builder', params: { token: detail.order_token } });
  };

  if (!detail) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-bg">
        <ActivityIndicator color="#1746A2" />
      </SafeAreaView>
    );
  }

  const lineItems = detail.line_items ?? [];

  return (
    <SafeAreaView className="flex-1 bg-bg">
      <View className="flex-row items-center gap-3 px-5 pt-3">
        <Pressable
          accessibilityRole="button"
          onPress={() => router.back()}
          className="h-10 w-10 items-center justify-center rounded-full bg-surface"
        >
          <ChevronLeft color="#1A1D2E" size={22} />
        </Pressable>
        <View className="flex-1">
          <Text className="font-display text-lg font-bold text-ink">
            Bill #{detail.order_token}
          </Text>
          <Text className="text-xs text-ink-2">{new Date(detail.created_at).toLocaleString()}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 160 }}>
        <Animated.View entering={FadeInDown.springify()} className="rounded-lg bg-surface p-4">
          <Text className="font-display text-sm font-bold text-ink-2">Customer</Text>
          <Text className="mt-1 font-display text-base font-bold text-ink">
            {detail.customer_name ?? '—'}
          </Text>
          <Text className="text-xs text-ink-2">{detail.customer_phone ?? '—'}</Text>
          {detail.customer_reg_no ? (
            <Text className="mt-1 text-xs text-ink-2">Reg: {detail.customer_reg_no}</Text>
          ) : null}
          {detail.customer_hostel_block || detail.customer_room_number ? (
            <Text className="mt-1 text-xs text-ink-2">
              Block {detail.customer_hostel_block ?? '—'} · Room{' '}
              {detail.customer_room_number ?? '—'}
            </Text>
          ) : null}
        </Animated.View>

        <Animated.View
          entering={FadeInDown.delay(80).springify()}
          className="mt-4 rounded-lg bg-surface p-4"
        >
          <Text className="font-display text-sm font-bold text-ink-2">Line items</Text>
          {lookupQuery.isLoading ? (
            <ActivityIndicator color="#1746A2" className="mt-3" />
          ) : lineItems.length === 0 ? (
            <Text className="mt-2 text-xs text-ink-2">No items recorded.</Text>
          ) : (
            <View className="mt-3 gap-2">
              {lineItems.map((li, i) => (
                <Animated.View
                  key={li.id}
                  entering={FadeInDown.delay(120 + i * 30).springify()}
                  className="flex-row items-center justify-between"
                >
                  <Text className="flex-1 text-sm text-ink">
                    {li.qty}× {li.label}
                  </Text>
                  <Text className="text-sm text-ink">₹{(li.qty * li.price).toFixed(2)}</Text>
                </Animated.View>
              ))}
            </View>
          )}
        </Animated.View>

        <Animated.View
          entering={FadeInDown.delay(180).springify()}
          className="mt-4 rounded-lg bg-surface p-4"
        >
          <Row label="Subtotal" value={`₹${detail.subtotal}`} />
          <Row label="Convenience" value={`₹${detail.convenience_fee}`} />
          <Row label="Total" value={`₹${detail.total}`} bold />
        </Animated.View>

        {detail.cancelled_at ? (
          <Text className="mt-3 text-center text-sm font-semibold text-error">
            Cancelled {new Date(detail.cancelled_at).toLocaleString()}
          </Text>
        ) : null}
        <Text className="mt-3 text-center text-xs text-ink-2">
          Note: Customers must count and check their clothes at collection.
        </Text>
      </ScrollView>

      <View className="absolute inset-x-0 bottom-0 border-t border-border bg-surface px-5 py-4">
        <View className="gap-2">
          <View className="flex-row gap-2">
            <Pressable
              accessibilityRole="button"
              onPress={printBluetooth}
              disabled={printer.printing}
              style={({ pressed }) => (pressed ? { transform: [{ scale: 0.98 }] } : null)}
              className="flex-1 flex-row items-center justify-center gap-2 rounded-lg bg-primary py-3 disabled:opacity-60"
            >
              {printer.printing ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Printer color="#fff" size={18} />
              )}
              <Text className="text-sm font-semibold text-white">Print</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={exportPdf}
              style={({ pressed }) => (pressed ? { transform: [{ scale: 0.98 }] } : null)}
              className="flex-1 flex-row items-center justify-center gap-2 rounded-lg border border-border bg-surface py-3"
            >
              <FileDown color="#1A1D2E" size={18} />
              <Text className="text-sm font-semibold text-ink">PDF</Text>
            </Pressable>
          </View>
          <View className="flex-row gap-2">
            <Pressable
              accessibilityRole="button"
              onPress={edit}
              disabled={!!detail.cancelled_at}
              style={({ pressed }) => (pressed ? { transform: [{ scale: 0.98 }] } : null)}
              className="flex-1 flex-row items-center justify-center gap-2 rounded-lg border border-border bg-surface py-3 disabled:opacity-50"
            >
              <Edit3 color="#1A1D2E" size={18} />
              <Text className="text-sm font-semibold text-ink">Edit</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={remove}
              disabled={!!detail.cancelled_at}
              style={({ pressed }) => (pressed ? { transform: [{ scale: 0.98 }] } : null)}
              className="flex-row items-center justify-center gap-2 rounded-lg border border-error bg-surface px-4 py-3 disabled:opacity-50"
            >
              <Trash2 color="#DC2626" size={18} />
            </Pressable>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <View className="flex-row items-center justify-between py-1">
      <Text className={bold ? 'font-display text-base font-bold text-ink' : 'text-sm text-ink-2'}>
        {label}
      </Text>
      <Text className={bold ? 'font-display text-base font-bold text-ink' : 'text-sm text-ink'}>
        {value}
      </Text>
    </View>
  );
}
