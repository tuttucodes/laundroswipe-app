import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { ChevronLeft, Printer, Share2 } from 'lucide-react-native';
import { useBluetoothPrinter } from '@/hooks/use-bluetooth-printer';
import { buildVendorReceiptEscPos } from '@/lib/printing/receipt/vendorReceipt';
import { vendorBillRowToThermalReceiptData } from '@/lib/printing/receipt/thermalReceiptTypes';
import { shareBillPdf } from '@/lib/printing/share-pdf';
import { useCachedBillById } from '@/hooks/use-cached-bills';
import { Container } from '@/components/ui/Container';

export default function CustomerBillDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const printer = useBluetoothPrinter();

  const billQuery = useCachedBillById(id ? String(id) : null);

  const bill = billQuery.data;
  const lineItems = bill?.line_items ?? [];
  const showSkeleton = billQuery.isPending && !billQuery.data;

  const printBluetooth = async () => {
    if (!bill) return;
    if (!printer.prefs?.mac) {
      Alert.alert('No printer', 'Open vendor printer settings to pick a paired printer first.');
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
    const data = vendorBillRowToThermalReceiptData(bill);
    const bytes = buildVendorReceiptEscPos(printer.prefs.paper, {
      vendorName: data.subtitle ?? 'LaundroSwipe',
      tokenLabel: data.token,
      orderLabel: data.orderId,
      customerLabel: data.customer.name,
      phoneLabel: data.customer.phone,
      customerDisplayId: data.customerId,
      regNo: data.customer.regNo,
      hostelBlock: bill.customer_hostel_block ?? undefined,
      roomNumber: bill.customer_room_number ?? undefined,
      dateStr: data.dateTime,
      lineItems: data.items.map((i) => ({ label: i.name, qty: i.qty, price: i.rate })),
      totalItems: data.items.reduce((s, i) => s + i.qty, 0),
      subtotal: Number(bill.subtotal ?? 0),
      serviceFeeLine: `Service fee: Rs.${Number(bill.convenience_fee ?? 0).toFixed(2)}`,
      total: Number(bill.total ?? data.total ?? 0),
      footer: data.footer,
    });
    const r = await printer.print(bytes);
    if (!r.ok) Alert.alert('Print failed', r.error);
    else Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
  };

  const sharePdf = async () => {
    if (!bill) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    const r = await shareBillPdf(bill);
    if (!r.ok) Alert.alert('Share failed', r.error);
  };

  if (showSkeleton) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-bg">
        <ActivityIndicator color="#1746A2" />
      </SafeAreaView>
    );
  }
  if (!bill) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-bg px-8">
        <Text className="text-center font-display text-lg font-semibold text-ink">
          Bill not found
        </Text>
      </SafeAreaView>
    );
  }

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
          <Text className="font-display text-lg font-bold text-ink">Bill #{bill.order_token}</Text>
          <Text className="text-xs text-ink-2">{bill.vendor_name ?? 'Partner'}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 140 }}>
        <Container style={{ padding: 20 }}>
          <Animated.View entering={FadeInDown.springify()} className="rounded-lg bg-surface p-4">
            <Text className="font-display text-sm font-bold text-ink-2">Items</Text>
            {lineItems.length === 0 ? (
              <Text className="mt-2 text-xs text-ink-2">No items recorded.</Text>
            ) : (
              <View className="mt-3 gap-2">
                {lineItems.map((li, i) => (
                  <Animated.View
                    key={li.id}
                    entering={FadeInDown.delay(60 + i * 30).springify()}
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
            entering={FadeInDown.delay(150).springify()}
            className="mt-4 rounded-lg bg-surface p-4"
          >
            <SummaryRow label="Subtotal" value={`₹${bill.subtotal}`} />
            <SummaryRow label="Convenience" value={`₹${bill.convenience_fee}`} />
            <SummaryRow label="Total" value={`₹${bill.total}`} bold />
          </Animated.View>

          {bill.cancelled_at ? (
            <Text className="mt-3 text-center text-sm font-semibold text-error">
              Cancelled {new Date(bill.cancelled_at).toLocaleString()}
            </Text>
          ) : null}
          <Text className="mt-3 text-center text-xs text-ink-2">
            Note: Please count and check all clothes at collection. The vendor will not be liable for shortages or damage reported later.
          </Text>
        </Container>
      </ScrollView>

      <View className="absolute inset-x-0 bottom-0 border-t border-border bg-surface px-5 py-4">
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
            <Text className="text-sm font-semibold text-white">Bluetooth print</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={sharePdf}
            style={({ pressed }) => (pressed ? { transform: [{ scale: 0.98 }] } : null)}
            className="flex-1 flex-row items-center justify-center gap-2 rounded-lg border border-border bg-surface py-3"
          >
            <Share2 color="#1A1D2E" size={18} />
            <Text className="text-sm font-semibold text-ink">Share PDF</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

function SummaryRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
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
