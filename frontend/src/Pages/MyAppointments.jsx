import React, { useContext, useEffect, useState } from 'react'
import { AppContext } from '../context/AppContext'
import axios from 'axios'
import { toast } from 'react-toastify'
import {useNavigate, useSearchParams} from 'react-router-dom'

const MyAppointments = () => {

  const { backendUrl, token,getDoctorsData } = useContext(AppContext)
  
  const [appointments, setAppointments] = useState([])
  const months = ["","Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
  
  // const navigate = useNavigate()
  // const [searchParams, setSearchParams] = useSearchParams()
  
  // const success = searchParams.get('success')
  // const appointmentId = searchParams.get('appointmentId')
  
  const slotDateFormat = (slotDate) => {
    const dateArray = slotDate.split(' ')
    return dateArray[0] + " " + months[Number(dateArray[1])] + " " + dateArray[2]
  }


  const getUserAppointments = async () => {
    try {
      const { data } = await axios.get(backendUrl + '/api/user/appointments', { headers: { token } })
      
      if (data.success) {
        setAppointments(data.appointments.reverse())
        console.log(data.appointments)
      }
    } catch (error) {
      console.log(error)
      toast.error(error.message)
    }
  }

  const cancelAppointment = async (appointmentId) => {
    
    try {
      const { data } = await axios.post(backendUrl + '/api/user/cancel-appointment', { appointmentId }, { headers: { token } })
      if (data.success) {
        toast.success(data.message)
        getUserAppointments()
        getDoctorsData()
      } else {
        toast.error(data.message)
      }
    } catch (error) {
      
    }
  }

  // const verifyPayment = async () => {
  //   try {
      
  //     if (!token) {
  //       return null
  //     }
  //     const response = await axios.post(backendUrl + '/api/user/verifyStripe', {  success,appointmentId }, { headers: { token } })
  //     if (response.data.success) {
  //       getUserAppointments()
  //       navigate('/my-appointments')
  //       console.log(response.data.success)
  //     } else {
  //       navigate('/')
  //     }
  //   } catch (error) {
  //     console.log(error)
  //     toast.error(error.message)
  //   }
  // }
  const appointmentStripe = async (appointmentId) => {
    
    try {
      
      const  responseStripe  = await axios.post(backendUrl + '/api/user/payment-stripe', { appointmentId }, { headers: { token } })
    

      if (responseStripe.data.success) {
        const { session_url } = responseStripe.data; // Extract session_url from the response
        window.location.replace(session_url); // Redirect user to the Stripe session
        console.log(session_url)
        verifyPayment()
      } else {
        console.error("Payment initiation failed:", data.message); // Log the error message from the backend
      }
      
    } catch (error) {
      // Handle any errors during the API call
      console.error("Error occurred during payment:", error.message);
    }
  }


  useEffect(() => {
    if (token) {
      getUserAppointments()
      
    }
  },[token])
  return (
    <div>
      <p className='pb-3 mt-12 font-medium text-zinc-700 border-b '>My appointments</p>
      <div>
        {
          appointments.map((item, index) => (
            <div className='grid grid-cols-[1fr_2fr] gap-4 sm:flex sm:gap-6 py-2 border-b' key={index}>
              <div>
                <img className='w-32 bg-indigo-50' src={item.docData.image} alt="" />
              </div>
              <div className='flex-1 text-sm text-zinc-600'>
                <p className='text-neutral-800 font-semibold'>{ item.docData.name}</p>
                <p>{ item.docData.speciality}</p>
                <p className='text-zinc-700 font-medium mt-1'>Address:</p>
                <p className='text-xs'>{ item.docData.address.line1}</p>
                <p className='text-xs'>{ item.docData.address.line2}</p>
                <p className='text-xs mt-1'><span className='text-sm text-neutral-700 font-medium'>Date & Time</span> {slotDateFormat(item.slotDate)} | {item.slotTime}</p>
              </div>
              <div></div>
              <div className='flex flex-col gap-2 justify-end'>
                {!item.cancelled  && item.payment && <button className='sm:min-w-48 py-2 border rounded text-stone-500 bg-indigo-50'>Paid</button> }
                {!item.cancelled  && !item.payment && !item.isCompleted && <button onClick={()=>appointmentStripe(item._id)} className='text-sm text-stone-500 text-center sm:min-w-48 py-2 border rounded hover:bg-primary hover:text-white transition-all duration-300'>Pay Online</button>}
                {!item.cancelled  && !item.isCompleted && <button onClick={() => cancelAppointment(item._id)} className='text-sm text-stone-500 text-center sm:min-w-48 py-2 border rounded hover:bg-red-600 hover:text-white transition-all duration-300'>Cancel appointment</button>}
                {item.cancelled && !item.isCompleted && <button className='sm:min-w-48 py-2 border border-red-500 rounded text-red-500 '>Appointment Cancelled</button>}
                {item.isCompleted && <button className='sm:min-w-48 py-2 border border-green-500 rounded text-green-500'>Completed</button>}
              </div>
            </div>
          ))
        }
      </div>
    </div>
  )
}

export default MyAppointments