// File Location: api/auth.js
// Purpose: 100% Cross-Checked 2Factor SMS OTP Send & Verify (Fixed VERIFY vs VERIFY3 Bug)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  // Vercel कभी-कभी body को string में रखता है, इसलिए सेफ्टी के लिए parse चेक:
  const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  const { action, mobile, otp, sessionId } = body;

  const TWOFACTOR_API_KEY = process.env.TWOFACTOR_API_KEY;

  if (!TWOFACTOR_API_KEY) {
    return res.status(500).json({ success: false, error: 'Missing TWOFACTOR_API_KEY in Vercel Environment Variables' });
  }

  try {
    // मोबाइल नंबर को 10-डिजिट में साफ करें (+91 या स्पेस हटाएं)
    const cleanMobile = mobile ? String(mobile).replace(/\D/g, '').slice(-10) : '';

    // =========================================================
    // ACTION 1: SEND OTP
    // =========================================================
    if (action === 'send-otp') {
      if (cleanMobile.length !== 10) {
        return res.status(400).json({ success: false, error: 'Valid 10-digit mobile number required' });
      }

      // Standard AUTOGEN endpoint जो हमेशा सही Session ID रिटर्न करता है
      const sendUrl = `https://2factor.in/API/V1/${TWOFACTOR_API_KEY}/SMS/${cleanMobile}/AUTOGEN`;
      
      const response = await fetch(sendUrl);
      const data = await response.json();

      if (data.Status === 'Success') {
        // data.Details में असली Session ID होती है
        return res.status(200).json({ 
          success: true, 
          sessionId: data.Details,
          mobile: cleanMobile
        });
      } else {
        return res.status(400).json({ success: false, error: data.Details || 'Failed to send OTP' });
      }
    }

    // =========================================================
    // ACTION 2: VERIFY OTP (FIXED ENDPOINT)
    // =========================================================
    if (action === 'verify-otp') {
      const cleanOtp = otp ? String(otp).replace(/\D/g, '') : '';

      if (!cleanOtp || (cleanOtp.length !== 4 && cleanOtp.length !== 6)) {
        return res.status(400).json({ success: false, error: 'Please enter valid 6-digit OTP' });
      }

      // 1. सबसे पहले Session ID से स्टैण्डर्ड VERIFY कॉल करें (यहाँ VERIFY3 नहीं, VERIFY लगता है!)
      if (sessionId) {
        const verifySessionUrl = `https://2factor.in/API/V1/${TWOFACTOR_API_KEY}/SMS/VERIFY/${sessionId}/${cleanOtp}`;
        const sessionRes = await fetch(verifySessionUrl);
        const sessionData = await sessionRes.json();

        if (sessionData.Status === 'Success') {
          return res.status(200).json({ success: true, message: 'OTP Verified Successfully' });
        }
      }

      // 2. Fallback: अगर यूजर ने मोबाइल नंबर भी भेजा है, तो VERIFY3 (जो मोबाइल नंबर लेता है) से भी चेक कर लें
      if (cleanMobile.length === 10) {
        const verifyMobileUrl = `https://2factor.in/API/V1/${TWOFACTOR_API_KEY}/SMS/VERIFY3/${cleanMobile}/${cleanOtp}`;
        const mobileRes = await fetch(verifyMobileUrl);
        const mobileData = await mobileRes.json();

        if (mobileData.Status === 'Success') {
          return res.status(200).json({ success: true, message: 'OTP Verified Successfully' });
        }
      }

      // अगर दोनों में फेल हुआ, मतलब सच में गलत OTP डाला गया है
      return res.status(400).json({ 
        success: false, 
        error: 'OTP Mismatch! Please enter the latest 6-digit OTP received on your phone.' 
      });
    }

    return res.status(400).json({ success: false, error: 'Invalid action' });

  } catch (error) {
    console.error("2Factor API Error:", error);
    return res.status(500).json({ success: false, error: 'Server Verification Error: ' + error.message });
  }
}
