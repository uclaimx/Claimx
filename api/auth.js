// File Location: api/auth.js
// Purpose: Strictly handles 6-Digit 2Factor SMS OTP Sending & Verification

export default async function handler(req, res) {
  // 1. सुरक्षा जाँच: सिर्फ POST रिक्वेस्ट
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  const { action, mobile, otp, sessionId } = req.body;
  
  // 2. आपकी 2Factor API Key
  const TWOFACTOR_API_KEY = process.env.TWOFACTOR_API_KEY || "76465719-2e4e-11f1-ae4a-0200cd936042";

  try {
    // =========================================================
    // ACTION 1: SEND OTP (6-Digit)
    // =========================================================
    if (action === 'send-otp') {
      if (!mobile) return res.status(400).json({ success: false, error: 'Mobile number required' });

      const cleanMobile = mobile.replace('+91', '').trim();

      // 2Factor API Call (OTP1 टेम्पलेट)
      const url = `https://2factor.in/API/V1/${TWOFACTOR_API_KEY}/SMS/${cleanMobile}/AUTOGEN2/OTP1`;
      
      const response = await fetch(url);
      const data = await response.json();

      if (data.Status === 'Success') {
        // data.Details में Session ID होता है
        return res.status(200).json({ success: true, sessionId: data.Details });
      } else {
        throw new Error(data.Details || 'Failed to send OTP');
      }
    }

    // =========================================================
    // ACTION 2: VERIFY STRICT 6-DIGIT OTP
    // =========================================================
    if (action === 'verify-otp') {
      if (!otp || !sessionId) {
        return res.status(400).json({ success: false, error: 'OTP and Session ID required' });
      }

      const cleanOtp = String(otp).trim();

      // बैकएंड चेक: OTP सिर्फ 6 अंकों का होना चाहिए
      if (cleanOtp.length !== 6) {
        return res.status(400).json({ success: false, error: 'OTP must be exactly 6 digits' });
      }

      // 2Factor Verification Call
      const url = `https://2factor.in/API/V1/${TWOFACTOR_API_KEY}/SMS/VERIFY3/${sessionId}/${cleanOtp}`;
      
      const response = await fetch(url);
      const data = await response.json();

      // 2Factor का स्टेटस चेक करें
      if (data.Status === 'Success' && data.Details === 'OTP Matched') {
        return res.status(200).json({ success: true, message: 'OTP Verified Successfully' });
      } else {
        return res.status(400).json({ success: false, error: data.Details || 'Invalid or Expired OTP' });
      }
    }

    return res.status(400).json({ success: false, error: 'Invalid action' });

  } catch (error) {
    console.error("2Factor API Error:", error);
    return res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
}
