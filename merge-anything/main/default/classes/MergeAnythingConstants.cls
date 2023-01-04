public class MergeAnythingConstants {
    public static final MergeJobStatus MERGE_JOB_STATUS = new MergeJobStatus();

    public class MergeJobStatus {
        public final String PENDING = 'Pending';
        public final String IN_PROGRESS = 'In Progress';
        public final String COMPLETED = 'Completed';
        public final String FAILED = 'Failed';
    }
}