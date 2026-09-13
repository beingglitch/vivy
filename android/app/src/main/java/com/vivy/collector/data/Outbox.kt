package com.vivy.collector.data

import androidx.room.ColumnInfo
import androidx.room.Dao
import androidx.room.Database
import androidx.room.Entity
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.PrimaryKey
import androidx.room.Query
import androidx.room.RoomDatabase
import kotlinx.coroutines.flow.Flow

/**
 * The outbox.
 *
 * Every collector writes here and nothing talks to the network directly. That
 * inversion is what makes capture safe on a phone: no signal, server down,
 * battery saver killing the sync job, and the only consequence is a longer
 * queue.
 *
 * Rows are kept after sending rather than deleted, so the app can show what it
 * has captured over time and not just what is waiting. `syncedAt` is the
 * difference between the two.
 */
@Entity(tableName = "outbox")
data class OutboxRow(
    @PrimaryKey val id: String,
    /** `raw` or `event`. Decides which array of the push payload it joins. */
    val kind: String,
    val source: String,
    @ColumnInfo(name = "ts") val timestamp: Long,
    /** The serialised record, ready to send verbatim. */
    val payload: String,
    @ColumnInfo(name = "dedupe_key") val dedupeKey: String,
    @ColumnInfo(name = "synced_at") val syncedAt: Long? = null,
)

@Dao
interface OutboxDao {
    /**
     * Ignore on conflict, because the dedupe key is derived from the
     * observation. A message delivered twice by the system, or a usage window
     * re-read after a crash, must not queue twice.
     */
    @Insert(onConflict = OnConflictStrategy.IGNORE)
    suspend fun add(row: OutboxRow): Long

    @Query("SELECT * FROM outbox WHERE synced_at IS NULL ORDER BY ts ASC LIMIT :limit")
    suspend fun pending(limit: Int): List<OutboxRow>

    @Query("UPDATE outbox SET synced_at = :now WHERE id IN (:ids)")
    suspend fun markSynced(ids: List<String>, now: Long)

    @Query("SELECT COUNT(*) FROM outbox")
    fun capturedCount(): Flow<Int>

    @Query("SELECT COUNT(*) FROM outbox WHERE synced_at IS NULL")
    fun queuedCount(): Flow<Int>

    @Query("SELECT COUNT(*) FROM outbox WHERE synced_at IS NOT NULL")
    fun syncedCount(): Flow<Int>

    @Query("SELECT COUNT(*) FROM outbox WHERE kind = 'raw' AND source = 'android.sms'")
    fun smsCount(): Flow<Int>

    @Query("SELECT COUNT(*) FROM outbox WHERE kind = 'event' AND source = 'android.usage'")
    fun usageCount(): Flow<Int>

    @Query("SELECT MAX(ts) FROM outbox WHERE source = :source")
    suspend fun latestTimestamp(source: String): Long?

    /**
     * Drop synced rows past the retention window.
     *
     * The phone is not the archive; the server is. Keeping everything forever
     * would fill a device that has better uses for the space.
     */
    @Query("DELETE FROM outbox WHERE synced_at IS NOT NULL AND ts < :before")
    suspend fun evictSyncedBefore(before: Long): Int
}

@Database(entities = [OutboxRow::class], version = 1, exportSchema = false)
abstract class VivyDb : RoomDatabase() {
    abstract fun outbox(): OutboxDao
}
