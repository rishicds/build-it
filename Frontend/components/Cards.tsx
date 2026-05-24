import React from 'react'
import { FaStarOfLife } from "react-icons/fa";
import { RiWechatChannelsLine } from "react-icons/ri";
import { FaWhatsapp } from "react-icons/fa6";
import { TbDeviceDesktopAnalytics } from "react-icons/tb";
import { RiImageAddFill } from "react-icons/ri";
import { MdAutoGraph } from "react-icons/md";

const Cards = () => {
  const features = [
    {
      icon: <FaStarOfLife className="text-white/80" />,
      title: "Personalized Multichannel Outreach",
      description: "Launch personalized campaigns across WhatsApp, Voice, and Calls with one unified workflow."
    },
    {
      icon: <RiWechatChannelsLine className="text-white/80" />,
      title: "RAG‑Powered AI Responses",
      description: "Upload your documents and let OutreachX answer customer queries with grounded, accurate AI using RAG."
    },
    {
      icon: <FaWhatsapp className="text-white/80" />,
      title: "AI‑Powered WhatsApp Conversations",
      description: "Contacts get instant, context-aware replies on WhatsApp powered by Gemini and LangGraph orchestration."
    },
    {
      icon: <TbDeviceDesktopAnalytics className="text-white/80" />,
      title: "Realtime Analytics",
      description: "Monitor delivery, engagement, and call metrics in real time to optimize campaign performance."
    },
    {
      icon: <RiImageAddFill className="text-white/80" />,
      title: "AI Voice Notes & Calls",
      description: "Generate voice notes (Gemini TTS) and make AI phone calls (VAPI) with natural-sounding audio."
    },
    {
      icon: <MdAutoGraph className="text-white/80" />,
      title: "Fast Onboarding & Compliance",
      description: "Get started quickly with onboarding flows and built‑in compliance reminders for messaging."
    }
  ];

  return (
    <div className='w-full bg-black py-20 px-4 md:px-8 lg:px-16 mb-50'>
      <div className='max-w-6xl mx-auto mb-16'>
        <h2 className=' text-white/80 leading-none'>
          <span className='block text-left text-xl md:text-4xl ml-5 font-instrument'>Built for modern</span>
          <span className='block text-center text-6xl md:text-[20vh] font-instrument italic'>Outreach.</span>
        </h2>
      </div>
      <div className='grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto'>
        {features.map((feature, index) => {
          const glowColors = [
            'rgba(249, 115, 22, 0.5)',
            'rgba(6, 182, 212, 0.5)',
            'rgba(139, 92, 246, 0.5)',
            'rgba(34, 197, 94, 0.5)',
            'rgba(239, 68, 68, 0.5)',
            'rgba(99, 102, 241, 0.5)',
          ]
          const glow = glowColors[index % glowColors.length]
          
          return (

            
          <div 
            key={index}
            className='group relative'
            style={{ perspective: '1000px' }}
          >
            <div 
              className='rounded-xl p-6 border border-white/30 backdrop-blur-3xl bg-transparent transition-all duration-300 shadow-lg flex flex-col justify-between min-h-95 relative overflow-hidden group-hover:scale-105'
              style={{
                boxShadow: `0 0 40px ${glow}, 0 0 80px ${glow}30, inset 0 1px 1px rgba(255,255,255,0.1)`,
              }}
            >
              <div className='absolute inset-0 bg-linear-to-br from-white/5 to-transparent pointer-events-none'></div>
              
              <div 
                className='absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none'
                style={{
                  background: `linear-gradient(180deg, rgba(255,255,255,0.08) 0%, transparent 50%)`,
                }}
              ></div>

              
              <div 
                className='absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none'
                style={{
                  background: `radial-gradient(circle at bottom center, ${glow}, transparent 70%)`,
                  filter: 'blur(20px)',
                }}
              ></div>
              
              <div className='relative z-10'>
                <h3 className='text-4xl text-white mb-3 font-instrument'>
                  {feature.title}
                </h3>
                <p className='text-sm text-white/70 leading-relaxed font-sans'>
                  {feature.description}
                </p>
              </div>
              
              <div className='flex justify-center relative z-10 pt-4'>
                <div className='text-5xl text-white/60'>
                  <span className='inline-flex transition-transform duration-300 ease-out group-hover:scale-140 group-hover:-translate-y-1'>
                    {feature.icon}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )})}
      </div>
      </div>
   
  )
}

export default Cards