import validator from 'validator'
import bcrypt from 'bcrypt'
import userModel from '../models/userModel.js'
import jwt from 'jsonwebtoken'
import {v2 as cloudinary} from 'cloudinary'
import doctorModel from '../models/doctorModel.js'
import appointmentModel from '../models/appointmentModel.js'
import Stripe from 'stripe'

// API to register user
const registerUser = async (req, res) => {
    try {
        
        const { name, email, password } = req.body
        
        if (!name || !password || !email) {
            return res.json({success:false,message:"Missing Details"})
        }

        // validating email format
        if (!validator.isEmail(email)) {
            return res.json({success:false,message:"enter a valid email"})
        }

        // validating strong password
        if (password < 8) {
            return res.json({success:false,message:"enter a strong password"})
        }

        // hashing user password
        const salt = await bcrypt.genSalt(10)
        const hashedPassword= await bcrypt.hash(password,salt)
        const userData = {
            name,
            email,
            password:hashedPassword
        }

        const newUser = new userModel(userData)
        const user = await newUser.save()
        
        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET)
        
        res.json({success:true,token})

    } catch (error) {
        console.log(error)
        res.json({success:false,message:error.message})
    }
}

// API for user login

const loginUser = async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await userModel.findOne({ email });
        
        // Check if user exists
        if (!user) {
            return res.json({ success: false, message: 'User does not exist' });
        }

        // Check if the password matches
        const isMatch = await bcrypt.compare(password, user.password);
        
        if (isMatch) {
            // Generate token if credentials are valid
            const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET);
            return res.json({ success: true, token });
        } else {
            // If password does not match
            return res.json({ success: false, message: 'Invalid credentials' });
        }

    } catch (error) {
        console.log(error);
        // Handle server error
        if (!res.headersSent) {  // Ensures only one response is sent
            return res.json({ success: false, message: error.message });
        }
    }
};

// API to get user profile data
const getProfile = async (req,res) => {

    try {
        
        const { userId } = req.body
        const userData = await userModel.findById(userId).select('-password')
        
        res.json({success:true,userData})
    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message });
    }
} 


// API to update user profile
const updateProfile = async (req, res) => {
    try {
        
        const { userId, name, phone, address, dob, gender } = req.body
        const imageFile = req.file

        if (!name || !phone || !dob || !gender) {
            return res.json({ success: false, message: "Data Missing" })
            
        }

        await userModel.findByIdAndUpdate(userId, { name, phone, address: JSON.parse(address), dob, gender })
        
        if (imageFile) {
            
            // upload image to cloudinary
            const imageUpload = await cloudinary.uploader.upload(imageFile.path, { resource_type: 'image' })
            const imageURL = imageUpload.secure_url
            
            await userModel.findByIdAndUpdate(userId,{image:imageURL})
        }

        res.json({ success: true, message: "Profile Updated" })
        
    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message });
    }
}

// API to book appointment
const bookAppointment = async (req,res) => {
    try {
        
        const { userId, docId, slotDate, slotTime } = req.body
        
        const docData = await doctorModel.findById(docId).select('-password')
        
        if (!docData.available) {
            return res.json({success:false,message:'Doctor not available'})
        }

        let slots_booked = docData.slots_booked
        
        // chacking for slot availability
        if (slots_booked[slotDate]) {
            if (slots_booked[slotDate].includes(slotTime)) {
                return res.json({success:false,message:'Slot not available'})
            } else {
                slots_booked[slotDate].push(slotTime)
            }
        } else {
            slots_booked[slotDate] = []
            slots_booked[slotDate].push(slotTime)
        }

        const userData = await userModel.findById(userId).select('-password')
        
        delete docData.slots_booked

        const appointmentData = {
            userId,
            docId,
            userData,
            docData,
            amount: docData.fees,
            slotTime,
            slotDate,
            date:Date.now()
        }

        const newAppointment = new appointmentModel(appointmentData)
        await newAppointment.save()

        // save new slots data in docData
        await doctorModel.findByIdAndUpdate(docId, { slots_booked })
        res.json({success:true,message:'Appointment Booked'})

    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message });
    }
}

// API to get user appointments for frontend my-appointments page 
const listAppointment = async (req, res) => {
    try {
        const { userId } = req.body
        const appointments = await appointmentModel.find({ userId })
        
        res.json({success:true,appointments})
    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message });
    }
}

// API to cancel appointment
const cancelAppointment = async (req,res) => {
    try {

        const { userId, appointmentId } = req.body
        
        const appointmentData = await appointmentModel.findById(appointmentId)
        
        // Verify appointment user
        if (appointmentData.userId !== userId) {
            return res.json({success:false,message:'Unauthorized action'})
        }

        await appointmentModel.findByIdAndUpdate(appointmentId, { cancelled: true })
        
        // releasing doctor slot

        const { docId, slotDate, slotTime } = appointmentData
        const doctorData = await doctorModel.findById(docId)
        
        let slots_booked = doctorData.slots_booked
        
        slots_booked[slotDate] = slots_booked[slotDate].filter(e => e !== slotTime)
        
        await doctorModel.findByIdAndUpdate(docId, { slots_booked })
        
        res.json({success:true,message:"Appointment Cancelled"})
    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message });
    }
}


const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const clientUrl = process.env.CLIENT_URL;

// API to handle payment for an appointment using Stripe
const paymentStripe = async (req, res) => {
    try {
        const { appointmentId } = req.body; // Extracting appointmentId from the request body
        const { origin } = req.headers; // Extracting the request origin for success and cancel URLs
        console.log("Origin:", origin);

        // Validate input
        if (!appointmentId) {
            return res.status(400).json({ success: false, message: "Appointment ID is required" });
        }

        // Fetch the appointment data from the database
        const appointmentData = await appointmentModel.findById(appointmentId);
                // console.log(appointmentData)
        if (!appointmentData || appointmentData.cancelled) {
            return res.status(404).json({
                success: false,
                message: "Appointment not found or has been cancelled"
            });
        }

        // Check if the appointment has a valid amount
        if (!appointmentData.amount || appointmentData.amount <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid appointment amount"
            });
        }

        // Create a Stripe checkout session
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'], // Specify allowed payment methods
            line_items: [
                {
                    price_data: {
                        
                        currency: process.env.CURRENCY || 'usd', // Default to USD if not specified
                        product_data: {
                            name: `${appointmentId}`,
                            
                            description: 'Payment for medical appointment',
                        },
                        unit_amount: appointmentData.amount * 100, // Stripe expects the amount in cents
                    },
                    quantity: 1,
                },
            ],
        
            // order_id:appointmentId,
            success_url: `${origin}/verify?success=true&appointmentId=${appointmentData._id}`, // Success redirect URL
            cancel_url: `${origin}/verify?success=false&appointmentId=${appointmentData._id}`, // Cancel redirect URL
            mode: 'payment',
        });
        
        
        // Send the session details to the client
        res.json({ success: true, session_url: session.url ,session}); // Ensure session.url is correctly included


    } catch (error) {
        // Log the error for debugging
        console.error("Error in paymentStripe:", error);

        // Send an error response
        res.status(500).json({
            success: false,
            message: "An error occurred while creating the payment session",
            error: error.message // Include the error message for debugging
        });
    }
};

// api to verfiy payment of stripe
const verifyStripe = async (req, res) => {
    const {  appointmentId,success } = req.body
    
    try {
        if (success === 'true') {
            await appointmentModel.findByIdAndUpdate(appointmentId, { payment: true })
            res.json({success:true})
        } else {
            res.json({success:false})
        }
        
    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message });
    }
}



export {registerUser,loginUser, getProfile,updateProfile,bookAppointment,listAppointment,cancelAppointment,paymentStripe,verifyStripe}