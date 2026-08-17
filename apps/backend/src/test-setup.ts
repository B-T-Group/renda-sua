jest.mock('./notifications/notifications.service', () => ({
  NotificationsService: class NotificationsService {},
}));
