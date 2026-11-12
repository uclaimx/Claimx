// File Location: api/auth.js
// Purpose: Securely handles 2Factor SMS OTP Sending & Verification (STRICT MODE)

export default async function handler(req, res) {
  // 1. सुरक्षा जाँच: सिर्फ POST रिक्वेस्ट को ही एक्सेप्ट करें
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  const { action, mobile, otp, sessionId } = req.body;
  
  // 2. Vercel के .env से 2Factor API Key निकालें
  const TWOFACTOR_API_KEY = process.env.TWOFACTOR_API_KEY;

  if (!TWOFACTOR_API_KEY) {
    return res.status(500).json({ success: false, error: 'Server configuration error: Missing API Key' });
  }

  try {
    // =========================================================
    // ACTION 1: SEND OTP
    // =========================================================
    if (action === 'send-otp') {
      if (!mobile) {
        return res.status(400).json({ success: false, error: 'Mobile number is required' });
      }

      const cleanMobile = mobile.replace('+91', '').trim();

      // ध्यान दें: 4-डिजिट OTP के लिए हम 'AUTOGEN2/OTP1' का इस्तेमाल कर रहे हैं
      // (अगर 2Factor में आपका डिफ़ॉल्ट 6-डिजिट है, तो आपको उनके डैशबोर्ड में 4-डिजिट का टेम्पलेट बनाना होगा)
      const url = `https://2factor.in/API/V1/${TWOFACTOR_API_KEY}/SMS/${cleanMobile}/AUTOGEN2/OTP1`;
      
      const response = await fetch(url);
      const data = await response.json();

      if (data.Status === 'Success') {
        return res.status(200).json({ success: true, sessionId: data.Details });
      } else {
        throw new Error(data.Details || 'Failed to send OTP via SMS Gateway');
      }
    }

    // =========================================================
    // ACTION 2: VERIFY OTP (STRICT & ORIGINAL ONLY)
    // =========================================================
    if (action === 'verify-otp') {
      if (!otp || !sessionId) {
        return res.status(400).json({ success: false, error: 'OTP and Session ID are required' });
      }

      // सुरक्षा: चेक करें कि OTP सिर्फ 4 अंकों का ही हो
      if (String(otp).trim().length !== 4) {
        return res.status(400).json({ success: false, error: 'OTP must be exactly 4 digits' });
      }

      // 2Factor की असली Verify API कॉल करें (कोई डमी पासवर्ड नहीं)
      const url = `https://2factor.in/API/V1/${TWOFACTOR_API_KEY}/SMS/VERIFY3/${sessionId}/${otp}`;
      
      const response = await fetch(url);
      const data = await response.json();

      // सिर्फ तभी पास करें जब 2Factor कन्फर्म करे कि OTP सही है
      if (data.Status === 'Success') {
        return res.status(200).json({ success: true, message: 'OTP Verified Successfully' });
      } else {
        return res.status(400).json({ success: false, error: 'Invalid or Expired OTP' });
      }
    }

    return res.status(400).json({ success: false, error: 'Invalid action requested' });

  } catch (error) {
    console.error("2Factor API Error:", error);
    return res.status(500).json({ success: false, error: error.message || 'Internal Server Error' });
  }
}
