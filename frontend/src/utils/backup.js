import CryptoJS from 'crypto-js';
import { getDatabase } from './db';

/**
 * Export RxDB data, encrypt it with AES, and trigger a file download.
 */
export const exportEncryptedBackup = async (password) => {
    try {
        const db = await getDatabase();
        
        // Use the RxDBJsonDumpPlugin to export collections
        const portfoliosDump = await db.portfolios.exportJSON();
        const transactionsDump = await db.transactions.exportJSON();
        
        const backupData = {
            timestamp: new Date().toISOString(),
            version: '1.0',
            data: {
                portfolios: portfoliosDump,
                transactions: transactionsDump
            }
        };

        const jsonString = JSON.stringify(backupData);
        
        // Encrypt with AES
        const encrypted = CryptoJS.AES.encrypt(jsonString, password).toString();
        
        // Trigger download
        const blob = new Blob([encrypted], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `NovaPortfolio_Backup_${new Date().toISOString().split('T')[0]}.aes`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        return { success: true };
    } catch (error) {
        console.error("Backup failed:", error);
        return { success: false, error: error.message };
    }
};

/**
 * Import and decrypt an AES backup file into RxDB.
 */
export const importEncryptedBackup = async (file, password) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = async (e) => {
            try {
                const encryptedData = e.target.result;
                
                // Decrypt with AES
                const bytes = CryptoJS.AES.decrypt(encryptedData, password);
                const decryptedString = bytes.toString(CryptoJS.enc.Utf8);
                
                if (!decryptedString) {
                    throw new Error("Invalid password or corrupt backup file.");
                }
                
                const backupData = JSON.parse(decryptedString);
                
                if (!backupData.data || !backupData.data.portfolios) {
                    throw new Error("Invalid backup format.");
                }

                const db = await getDatabase();
                
                // Clear existing data (optional, or we can merge. Let's merge for now)
                // In RxDB, importJSON merges by default
                await db.portfolios.importJSON(backupData.data.portfolios);
                await db.transactions.importJSON(backupData.data.transactions);
                
                resolve({ success: true });
            } catch (error) {
                console.error("Import failed:", error);
                reject(error);
            }
        };
        
        reader.onerror = () => reject(new Error("Failed to read file."));
        reader.readAsText(file);
    });
};
