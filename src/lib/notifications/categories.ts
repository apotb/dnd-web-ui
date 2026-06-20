export type NotificationCategoryId = "alert";

export interface NotificationCategory {
  id: NotificationCategoryId;
  label: string;
}

export const NOTIFICATION_CATEGORIES: Record<
  NotificationCategoryId,
  NotificationCategory
> = {
  alert: {
    id: "alert",
    label: "Alert",
  },
};

export type NotificationAlertLevel = "critical" | "reminder";

export interface CampaignNotificationItem {
  id: string;
  category: NotificationCategoryId;
  title: string;
  ariaLabel: string;
  imageSrc: string;
  imageClassName?: string;
  alertLevel: NotificationAlertLevel;
  onClick: () => void;
}

export function groupNotificationsByCategory(
  items: CampaignNotificationItem[]
): { category: NotificationCategory; items: CampaignNotificationItem[] }[] {
  const grouped = new Map<
    NotificationCategoryId,
    CampaignNotificationItem[]
  >();

  for (const item of items) {
    const list = grouped.get(item.category) ?? [];
    list.push(item);
    grouped.set(item.category, list);
  }

  return Array.from(grouped.entries()).map(([categoryId, categoryItems]) => ({
    category: NOTIFICATION_CATEGORIES[categoryId],
    items: categoryItems,
  }));
}
