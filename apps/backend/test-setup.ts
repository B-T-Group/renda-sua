jest.mock('./src/notifications/notifications.service', () => ({
  NotificationsService: class NotificationsService {},
}));
