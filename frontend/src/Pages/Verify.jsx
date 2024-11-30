import React, { useContext, useEffect } from 'react'
import { AppContext } from '../context/AppContext'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'react-toastify'
import axios from 'axios'

const Verify = () => {
    const { backendUrl, token, getDoctorsData } = useContext(AppContext)
    const navigate = useNavigate()
    const [searchParams, setSearchParams] = useSearchParams()

    const success = searchParams.get('success')
    const appointmentId = searchParams.get('appointmentId')

    
    const verifyPayment = async () => {
        try {
          
          if (!token) {
            return null
          }
          const response = await axios.post(backendUrl + '/api/user/verifyStripe', {  success,appointmentId }, { headers: { token } })
          if (response.data.success) {
            // getUserAppointments()
            navigate('/my-appointments')
            console.log(response.data.success)
          } else {
            navigate('/')
          }
        } catch (error) {
          console.log(error)
          toast.error(error.message)
        }
      }

    useEffect(() => {
        verifyPayment()
    },[token])
return (
    <div>
        
    </div>
)
}

export default Verify