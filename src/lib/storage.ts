import { getStorage, ref, uploadString, getDownloadURL, listAll, getMetadata, deleteObject } from "firebase/storage";
import app from "./firebase";

const storage = getStorage(app);

export const uploadAttendancePhoto = async (
    employeeId: string,
    dataUrl: string
): Promise<string> => {
    try {
        const timestamp = Date.now();
        const fileName = `attendance/${employeeId}/${timestamp}.jpg`;
        const storageRef = ref(storage, fileName);

        // Upload the base64 image
        await uploadString(storageRef, dataUrl, 'data_url');

        // Get the download URL
        const downloadURL = await getDownloadURL(storageRef);
        return downloadURL;
    } catch (error) {
        console.error("Error uploading photo:", error);
        throw error;
    }
};

export const getStorageUsage = async (): Promise<{ totalBytes: number; fileCount: number }> => {
    try {
        const attendanceRef = ref(storage, 'attendance');
        const result = await listAll(attendanceRef);

        let totalBytes = 0;
        let fileCount = 0;

        // Get all employee folders
        for (const folderRef of result.prefixes) {
            const folderContents = await listAll(folderRef);

            // Get metadata for each file
            for (const itemRef of folderContents.items) {
                try {
                    const metadata = await getMetadata(itemRef);
                    totalBytes += metadata.size || 0;
                    fileCount++;
                } catch (error) {
                    console.error("Error getting metadata:", error);
                }
            }
        }

        return { totalBytes, fileCount };
    } catch (error) {
        console.error("Error calculating storage usage:", error);
        return { totalBytes: 0, fileCount: 0 };
    }
};

export const deleteOldPhotos = async (months: number): Promise<{ deletedCount: number; freedBytes: number }> => {
    try {
        const attendanceRef = ref(storage, 'attendance');
        const result = await listAll(attendanceRef);

        const cutoffDate = new Date();
        cutoffDate.setMonth(cutoffDate.getMonth() - months);

        let deletedCount = 0;
        let freedBytes = 0;

        // Get all employee folders
        for (const folderRef of result.prefixes) {
            const folderContents = await listAll(folderRef);

            // Check each file
            for (const itemRef of folderContents.items) {
                try {
                    const metadata = await getMetadata(itemRef);
                    const timeCreated = new Date(metadata.timeCreated);

                    if (timeCreated < cutoffDate) {
                        await deleteObject(itemRef);
                        deletedCount++;
                        freedBytes += metadata.size;
                    }
                } catch (error) {
                    console.error("Error processing file:", error);
                }
            }
        }

        return { deletedCount, freedBytes };
    } catch (error) {
        console.error("Error deleting old photos:", error);
        throw error;
    }
};
