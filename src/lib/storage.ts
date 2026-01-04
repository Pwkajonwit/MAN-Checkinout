import { collection, getDocs, query, where, orderBy, Timestamp, deleteDoc, doc } from "firebase/firestore";
import { db } from "./firebase";

// Constants for storage management
const STORAGE_LIMIT_BYTES = 800 * 1024 * 1024; // 800MB soft limit (Firestore free tier is 1GB)
const WARNING_THRESHOLD = 0.9; // 90% = show warning

export interface StorageStats {
    totalBytes: number;
    fileCount: number;
    limitBytes: number;
    usagePercent: number;
    isNearLimit: boolean;
    canUpload: boolean;
}

/**
 * Calculate the byte size of a base64 string
 */
export const calculateBase64Size = (base64String: string): number => {
    // Remove data URL prefix if present
    const base64Data = base64String.includes(',')
        ? base64String.split(',')[1]
        : base64String;

    // Calculate actual byte size
    // Base64 encodes 3 bytes into 4 characters
    const padding = (base64Data.match(/=/g) || []).length;
    return Math.floor((base64Data.length * 3) / 4) - padding;
};

/**
 * Compress base64 image by resizing and reducing quality
 * Returns a smaller base64 string
 */
export const compressBase64Image = async (
    base64String: string,
    maxWidth: number = 640,
    maxHeight: number = 480,
    quality: number = 0.6
): Promise<string> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            // Calculate new dimensions maintaining aspect ratio
            let { width, height } = img;

            if (width > maxWidth) {
                height = (height * maxWidth) / width;
                width = maxWidth;
            }
            if (height > maxHeight) {
                width = (width * maxHeight) / height;
                height = maxHeight;
            }

            // Create canvas and draw resized image
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;

            const ctx = canvas.getContext('2d');
            if (!ctx) {
                reject(new Error('Could not get canvas context'));
                return;
            }

            ctx.drawImage(img, 0, 0, width, height);

            // Convert to base64 with reduced quality
            const compressedBase64 = canvas.toDataURL('image/jpeg', quality);
            resolve(compressedBase64);
        };

        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = base64String;
    });
};

/**
 * Get storage usage from Firestore (counting photo field sizes)
 */
export const getStorageUsage = async (): Promise<StorageStats> => {
    try {
        const attendanceRef = collection(db, "attendance");
        const querySnapshot = await getDocs(attendanceRef);

        let totalBytes = 0;
        let fileCount = 0;

        querySnapshot.forEach((doc) => {
            const data = doc.data();
            if (data.photo && typeof data.photo === 'string') {
                // Calculate base64 size
                const photoSize = calculateBase64Size(data.photo);
                totalBytes += photoSize;
                fileCount++;
            }
        });

        const usagePercent = (totalBytes / STORAGE_LIMIT_BYTES) * 100;

        return {
            totalBytes,
            fileCount,
            limitBytes: STORAGE_LIMIT_BYTES,
            usagePercent,
            isNearLimit: usagePercent >= WARNING_THRESHOLD * 100,
            canUpload: totalBytes < STORAGE_LIMIT_BYTES
        };
    } catch (error) {
        console.error("Error calculating storage usage:", error);
        return {
            totalBytes: 0,
            fileCount: 0,
            limitBytes: STORAGE_LIMIT_BYTES,
            usagePercent: 0,
            isNearLimit: false,
            canUpload: true
        };
    }
};

/**
 * Check if there's enough space to upload a new photo
 */
export const canUploadPhoto = async (newPhotoBase64: string): Promise<{ canUpload: boolean; message: string }> => {
    try {
        const stats = await getStorageUsage();
        const newPhotoSize = calculateBase64Size(newPhotoBase64);
        const totalAfterUpload = stats.totalBytes + newPhotoSize;

        if (totalAfterUpload > STORAGE_LIMIT_BYTES) {
            const overBy = ((totalAfterUpload - STORAGE_LIMIT_BYTES) / (1024 * 1024)).toFixed(2);
            return {
                canUpload: false,
                message: `พื้นที่เก็บข้อมูลเต็ม! เกินลิมิตไป ${overBy} MB กรุณาลบรูปเก่าก่อน`
            };
        }

        if (stats.isNearLimit) {
            const remaining = ((STORAGE_LIMIT_BYTES - stats.totalBytes) / (1024 * 1024)).toFixed(2);
            return {
                canUpload: true,
                message: `คำเตือน: เหลือพื้นที่เพียง ${remaining} MB`
            };
        }

        return { canUpload: true, message: '' };
    } catch (error) {
        console.error("Error checking upload eligibility:", error);
        return { canUpload: true, message: '' }; // Allow upload on error
    }
};

/**
 * Delete old attendance photos (sets photo field to null)
 */
export const deleteOldPhotos = async (months: number): Promise<{ deletedCount: number; freedBytes: number }> => {
    try {
        const cutoffDate = new Date();
        cutoffDate.setMonth(cutoffDate.getMonth() - months);
        cutoffDate.setHours(0, 0, 0, 0);

        const attendanceRef = collection(db, "attendance");
        const q = query(
            attendanceRef,
            where("date", "<", Timestamp.fromDate(cutoffDate)),
            orderBy("date", "desc")
        );

        const querySnapshot = await getDocs(q);

        let deletedCount = 0;
        let freedBytes = 0;

        const { updateDoc } = await import("firebase/firestore");

        for (const docSnapshot of querySnapshot.docs) {
            const data = docSnapshot.data();
            if (data.photo && typeof data.photo === 'string') {
                const photoSize = calculateBase64Size(data.photo);

                // Remove photo field (set to null)
                await updateDoc(doc(db, "attendance", docSnapshot.id), {
                    photo: null
                });

                deletedCount++;
                freedBytes += photoSize;
            }
        }

        return { deletedCount, freedBytes };
    } catch (error) {
        console.error("Error deleting old photos:", error);
        throw error;
    }
};

/**
 * Delete all photos from attendance records (emergency cleanup)
 */
export const deleteAllPhotos = async (): Promise<{ deletedCount: number; freedBytes: number }> => {
    try {
        const attendanceRef = collection(db, "attendance");
        const querySnapshot = await getDocs(attendanceRef);

        let deletedCount = 0;
        let freedBytes = 0;

        const { updateDoc } = await import("firebase/firestore");

        for (const docSnapshot of querySnapshot.docs) {
            const data = docSnapshot.data();
            if (data.photo && typeof data.photo === 'string') {
                const photoSize = calculateBase64Size(data.photo);

                await updateDoc(doc(db, "attendance", docSnapshot.id), {
                    photo: null
                });

                deletedCount++;
                freedBytes += photoSize;
            }
        }

        return { deletedCount, freedBytes };
    } catch (error) {
        console.error("Error deleting all photos:", error);
        throw error;
    }
};

// Export constants for use in other files
export const PHOTO_STORAGE_LIMIT = STORAGE_LIMIT_BYTES;
export const PHOTO_WARNING_THRESHOLD = WARNING_THRESHOLD;
