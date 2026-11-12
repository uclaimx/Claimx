// File Location: api/auth.js
// Purpose: Securely handles 2Factor SMS OTP Sending & Verification

export default async function handler(req, res) {
  // 1. सुरक्षा जाँच: सिर्फ POST रिक्वेस्ट को ही एक्सेप्ट करें
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  // 2. फ्रंटएंड से आया डेटा पढ़ें
  const { action, mobile, otp, sessionId } = req.body;
  
  // 3. Vercel के .env से 2Factor API Key निकालें (यह पब्लिक नहीं होगी)
  const TWOFACTOR_API_KEY = process.env.TWOFACTOR_API_KEY;

  if (!TWOFACTOR_API_KEY) {
    return res.status(500).json({ success: false, error: 'Server configuration error: Missing API Key' });
  }

  try {
    // =========================================================
    // ACTION 1: SEND OTP (जब यूज़र "Send OTP" दबाएगा)
    // =========================================================
    if (action === 'send-otp') {
      if (!mobile) {
        return res.status(400).json({ success: false, error: 'Mobile number is required' });
      }

      // मोबाइल नंबर को साफ़ करें (अगर +91 लगा है तो हटा दें)
      const cleanMobile = mobile.replace('+91', '').trim();

      // 2Factor की SMS API को कॉल करें
      const url = `https://2factor.in/API/V1/${TWOFACTOR_API_KEY}/SMS/${cleanMobile}/AUTOGEN`;
      
      const response = await fetch(url);
      const data = await response.json();

      if (data.Status === 'Success') {
        // data.Details में Session ID होता है, जिसे वेरीफाई करने के लिए वापस फ्रंटएंड को भेजेंगे
        return res.status(200).json({ success: true, sessionId: data.Details });
      } else {
        throw new Error(data.Details || 'Failed to send OTP via SMS Gateway');
      }
    }

    // =========================================================
    // ACTION 2: VERIFY OTP (जब यूज़र 4-डिजिट कोड डालेगा)
    // =========================================================
    if (action === 'verify-otp') {
      if (!otp || !sessionId) {
        return res.status(400).json({ success: false, error: 'OTP and Session ID are required' });
      }

      // 2Factor की Verify API को कॉल करें
      const url = `https://2factor.in/API/V1/${TWOFACTOR_API_KEY}/SMS/VERIFY3/${sessionId}/${otp}`;
      
      const response = await fetch(url);
      const data = await response.json();

      if (data.Status === 'Success') {
        return res.status(200).json({ success: true, message: 'OTP Verified Successfully' });
      } else {
        return res.status(400).json({ success: false, error: 'Invalid or Expired OTP' });
      }
    }

    // अगर कोई गलत एक्शन भेजा गया हो
    return res.status(400).json({ success: false, error: 'Invalid action requested' });

  } catch (error) {
    console.error("2Factor API Error:", error);
    return res.status(500).json({ success: false, error: error.message || 'Internal Server Error' });
  }
}
