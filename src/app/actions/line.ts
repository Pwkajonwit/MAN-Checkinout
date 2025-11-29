'use server'

export async function sendPushMessage(userId: string, messages: any[]) {
    const channelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;

    if (!channelAccessToken) {
        console.error('LINE_CHANNEL_ACCESS_TOKEN is not set');
        return { success: false, error: 'LINE_CHANNEL_ACCESS_TOKEN is not set' };
    }

    try {
        const response = await fetch('https://api.line.me/v2/bot/message/push', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${channelAccessToken}`,
            },
            body: JSON.stringify({
                to: userId,
                messages: messages,
            }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error('Error sending LINE push message:', errorData);
            return { success: false, error: errorData };
        }

        return { success: true };
    } catch (error) {
        console.error('Error sending LINE push message:', error);
        return { success: false, error };
    }
}
