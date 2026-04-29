/**
 * @description Chained queueable chunks for large merge jobs (limits synchronous CPU/DML per transaction).
 */
public with sharing class MergeJobQueueable implements Queueable {
    private final Id mergeJobId;
    private final Boolean firstRun;

    public MergeJobQueueable(Id mergeJobId, Boolean firstRun) {
        this.mergeJobId = mergeJobId;
        this.firstRun = firstRun == null ? false : firstRun;
    }

    public void execute(QueueableContext context) {
        BulkMergeController.runAsyncMergeJobChunk(mergeJobId, firstRun);
    }
}
