public with sharing class MergeJobNotificationService {
    private static final String MERGE_JOB_FINISHED_TYPE = 'Merge_Job_Finished';

    /**
     * @description Best-effort Salesforce custom notification (bell). Silently no-ops if the type is missing in the
     *              org.
     */
    public static void notifyMergeJobFinished(Id mergeJobId, Id targetUserId, String jobStatus, Integer failedItemCount) {
        if (mergeJobId == null) {
            return;
        }
        if (targetUserId == null) {
            targetUserId = UserInfo.getUserId();
        }
        List<CustomNotificationType> types = [
            SELECT Id
            FROM CustomNotificationType
            WHERE DeveloperName = :MERGE_JOB_FINISHED_TYPE
            LIMIT 1
        ];
        if (types.isEmpty()) {
            return;
        }

        String body =
            'Completed'.equalsIgnoreCase(jobStatus)
                ? 'Background merge finished successfully.'
                : 'Background merge finished with ' +
                    String.valueOf(failedItemCount == null ? 0 : failedItemCount) +
                    ' failed item(s).';

        Messaging.CustomNotification notification = new Messaging.CustomNotification();
        notification.setTitle('Merge job: ' + jobStatus);
        notification.setBody(body);
        notification.setNotificationTypeId(types[0].Id);
        notification.setTargetId(mergeJobId);
        try {
            notification.send(new Set<String>{ targetUserId });
        } catch (Exception e) {
            System.debug(LoggingLevel.WARN, 'Custom notification failed: ' + e.getMessage());
        }
    }

    public static void notifyMergeJobPrecheckFailed(Id mergeJobId, Id targetUserId, String message) {
        if (mergeJobId == null) {
            return;
        }
        if (targetUserId == null) {
            targetUserId = UserInfo.getUserId();
        }
        List<CustomNotificationType> types = [
            SELECT Id
            FROM CustomNotificationType
            WHERE DeveloperName = :MERGE_JOB_FINISHED_TYPE
            LIMIT 1
        ];
        if (types.isEmpty()) {
            return;
        }
        Messaging.CustomNotification notification = new Messaging.CustomNotification();
        notification.setTitle('Merge job could not start');
        notification.setBody(truncateNotificationBody(message));
        notification.setNotificationTypeId(types[0].Id);
        notification.setTargetId(mergeJobId);
        try {
            notification.send(new Set<String>{ targetUserId });
        } catch (Exception e) {
            System.debug(LoggingLevel.WARN, 'Custom notification failed: ' + e.getMessage());
        }
    }

    private static String truncateNotificationBody(String message) {
        if (String.isBlank(message)) {
            return 'Validation failed.';
        }
        Integer maxLen = 3500;
        return message.length() > maxLen ? message.substring(0, maxLen) : message;
    }
}
