import { useState, useEffect } from 'react';
import { supabase } from '../supabase';

import { createPortal } from 'react-dom';

interface InfoModalProps {
  type: 'tos' | 'privacy' | 'contact' | 'faq';
  onClose: () => void;
}

export default function InfoModal({ type, onClose }: InfoModalProps) {
  const [contactInfo, setContactInfo] = useState<{
    company: string;
    orgnr: string;
    address: string;
    vat: string;
  }>({
    company: '',
    orgnr: '',
    address: '',
    vat: ''
  });
  const [visibility, setVisibility] = useState({
    company: true,
    orgnr: true,
    address: true,
    vat: true
  });
  const [loading, setLoading] = useState(true);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);

  const faqs = [
    {
      category: "💡 Betalning & pris",
      questions: [
        { q: "Är appen gratis?", a: "59 kr/månad (mindre än 2 kr per dag för hela hushållet).\n14 dagars gratis prov." },
        { q: "Hur avslutar jag prenumerationen?", a: "Under Inställningar i sidomenyn klickar du på \"Hantera prenumeration\" och följer länken till Stripe där du avslutar prenumerationen." }
      ]
    },
    {
      category: "🏠 Gemensam ekonomi",
      questions: [
        { q: "Hur fungerar uträkningen?", a: "Appen räknar ut hur kostnader ska delas baserat på era inlagda gemensamma kostnader." },
        { q: "Hur delar vi räkningar?", a: "Du kan välja 0%, 50% eller 100% per räkning." }
      ]
    },
    {
      category: "⚙️ Inställningar",
      questions: [
        { q: "Hur ändrar jag räkningar?", a: "Du kan redigera eller ta bort alla räkningar i Inställningar." }
      ]
    },
    {
      category: "🔒 Privat ekonomi",
      questions: [
        { q: "Vad är Privat-fliken?", a: "Dina egna inkomster och utgifter som inte påverkar den gemensamma ekonomin." }
      ]
    },
    {
      category: "📊 Statistik",
      questions: [
        { q: "Vad visar statistiken?", a: "Utvecklingen av inkomster, utgifter och kvarvarande pengar över tid." }
      ]
    }
  ];

  useEffect(() => {
    // Förhindra scroll i bakgrunden
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = 'unset'; };
  }, []);

  useEffect(() => {
    const fetchContactInfo = async () => {
      setLoading(true);
      const { data } = await supabase.from('global_settings').select('key, value');
      if (data) {
        const info = {
          company: data.find(d => d.key === 'contact_company')?.value || 'SmartEkonomi AB',
          orgnr: data.find(d => d.key === 'contact_orgnr')?.value || '-',
          address: data.find(d => d.key === 'contact_address')?.value || '-',
          vat: data.find(d => d.key === 'contact_vat')?.value || '-'
        };
        setContactInfo(info);
        setVisibility({
          company: data.find(d => d.key === 'show_contact_company')?.value !== 'false',
          orgnr: data.find(d => d.key === 'show_contact_orgnr')?.value !== 'false',
          address: data.find(d => d.key === 'show_contact_address')?.value !== 'false',
          vat: data.find(d => d.key === 'show_contact_vat')?.value !== 'false'
        });
      }
      setLoading(false);
    };
    fetchContactInfo();
  }, []);

  const titles = {
    tos: 'Användarvillkor (Terms of Service)',
    privacy: 'Integritetspolicy (GDPR)',
    contact: 'Kontakt',
    faq: 'Frågor & Svar'
  };

  return createPortal(
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(11, 15, 25, 0.95)', backdropFilter: 'blur(10px)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      zIndex: 99999, padding: '2rem'
    }}>
      <div style={{ 
        background: 'rgba(30, 41, 59, 0.95)', 
        border: '1px solid rgba(255, 255, 255, 0.1)', 
        borderRadius: '16px', 
        padding: '2rem', 
        maxWidth: '600px', 
        width: '100%', 
        maxHeight: '90vh',
        overflowY: 'auto',
        position: 'relative',
        boxShadow: '0 20px 40px rgba(0,0,0,0.8)' 
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h2 style={{ color: '#fff', fontSize: '1.5rem', margin: 0 }}>
            {titles[type]}
          </h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '1.5rem', cursor: 'pointer' }}>✕</button>
        </div>

        <div style={{ color: '#ccc', fontSize: '0.95rem', lineHeight: '1.6' }}>
          {type === 'tos' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <p>
                <strong style={{ color: '#fff' }}>Ansvarsbegränsning och friskrivning:</strong> SmartEkonomi tillhandahålls som ett hjälpmedel för beräkningar och budgetering. Appen ska ses som ett komplement och inte som finansiell rådgivning. Användaren ansvarar själv för att kontrollera att alla uträkningar och uppgifter stämmer innan ekonomiska beslut fattas. SmartEkonomi eller dess ägare kan inte hållas ansvariga för eventuella ekonomiska förluster, felaktiga beräkningar eller beslut baserade på appens data.
              </p>
              <p>
                <strong style={{ color: '#fff' }}>Prenumeration & Avgifter:</strong> Tjänsten kostar 59 kr/månad per hushåll. Nya användare får alltid 14 dagars kostnadsfri provperiod innan den första debiteringen sker via vår betalningspartner Stripe.
              </p>
              <p>
                <strong style={{ color: '#fff' }}>Uppsägning av tjänst:</strong> Du kan när som helst avsluta din prenumeration. Detta görs genom att navigera till <strong>Mina Sidor -&gt; Premium</strong> i appen och klicka på knappen <strong>Hantera Prenumeration</strong>. Du skickas då till Stripes säkra kundportal där du kan avbryta prenumerationen. Avslutar du under din 14-dagars provperiod debiteras du ingenting.
              </p>
              <p>
                <strong style={{ color: '#fff' }}>Återbetalningspolicy:</strong> Prenumerationen debiteras i förskott för varje påbörjad månad. Inga återbetalningar görs för delvis utnyttjade månader.
              </p>
              <p>
                <strong style={{ color: '#fff' }}>Tillämplig lag:</strong> Svensk lag gäller för dessa villkor.
              </p>
            </div>
          )}

          {type === 'privacy' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <p>
                <strong style={{ color: '#fff' }}>Personuppgiftsansvarig:</strong> {contactInfo.company} (org.nr {contactInfo.orgnr}) är personuppgiftsansvarig för behandlingen av dina uppgifter i appen.
              </p>
              <p>
                <strong style={{ color: '#fff' }}>Vilka uppgifter vi samlar in:</strong> Vi samlar enbart in din e-postadress (krävs för inloggning) samt de ekonomiska siffror och texter (såsom räkningar) du frivilligt matar in i systemet.
              </p>
              <p>
                <strong style={{ color: '#fff' }}>Laglig grund:</strong> Vi behandlar dina uppgifter med stöd i att kunna fullgöra vårt avtal med dig (leverera appens funktioner).
              </p>
              <p>
                <strong style={{ color: '#fff' }}>Tredjepart & Betalningar:</strong> Betalningsdata och kortuppgifter hanteras uteslutande av vår partner Stripe. Vi varken ser eller sparar dina kortuppgifter på våra egna servrar.
              </p>
              <p>
                <strong style={{ color: '#fff' }}>Dina rättigheter & Rätten att bli glömd:</strong> Du äger din data. Raderar du ditt konto i appen försvinner all din relaterade data automatiskt och permanent från vår databas. Du har även rätt att begära utdrag av din data, och rätt att lämna klagomål till Integritetsskyddsmyndigheten (IMY).
              </p>
              <p>
                <strong style={{ color: '#fff' }}>Cookies:</strong> Vi använder nödvändiga kakor (cookies/localstorage) uteslutande för att hålla dig inloggad och komma ihåg dina val (t.ex. att du sett välkomstrutan). Vi använder inga spårningscookies för tredjepartsreklam.
              </p>
            </div>
          )}

          {type === 'contact' && (
            <>
              {loading ? (
                <p>Laddar kontaktuppgifter...</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <p style={{ color: 'var(--text-secondary)', marginTop: '-0.5rem', marginBottom: '0' }}>
                    Välj rätt e-postadress för ditt ärende så kan vi hjälpa dig snabbare.
                  </p>
                  
                  {/* Kundservice / Support */}
                  <div style={{
                    background: 'rgba(16, 185, 129, 0.05)',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                    borderRadius: '12px',
                    padding: '1.25rem',
                    position: 'relative',
                    overflow: 'hidden'
                  }}>
                    <div style={{ position: 'absolute', top: '-10px', right: '-10px', fontSize: '4.5rem', opacity: 0.1 }}>💬</div>
                    <h3 style={{ margin: '0 0 0.25rem 0', color: '#10b981', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.1rem' }}>
                      För kunder
                    </h3>
                    <p style={{ margin: '0 0 0.75rem 0', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                      Har du problem med appen eller frågor om ditt konto?
                    </p>
                    <ul style={{ margin: '0 0 1rem 0', paddingLeft: '1.5rem', color: '#e2e8f0', display: 'flex', flexDirection: 'column', gap: '0.2rem', fontSize: '0.9rem' }}>
                      <li>Jag kommer inte in</li>
                      <li>Hur funkar bankfilen?</li>
                      <li>Jag vill säga upp prenumerationen</li>
                    </ul>
                    <a href="mailto:support@smartekonomi.nu" style={{ 
                      display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
                      background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                      color: '#fff', textDecoration: 'none', padding: '0.6rem 1.2rem',
                      borderRadius: '8px', fontWeight: 'bold', boxShadow: '0 4px 15px rgba(16, 185, 129, 0.3)',
                      fontSize: '0.95rem'
                    }}>
                      📧 support@smartekonomi.nu
                    </a>
                  </div>

                  {/* Info / Övrigt */}
                  <div style={{
                    background: 'rgba(59, 130, 246, 0.05)',
                    border: '1px solid rgba(59, 130, 246, 0.3)',
                    borderRadius: '12px',
                    padding: '1.25rem',
                    position: 'relative',
                    overflow: 'hidden'
                  }}>
                    <div style={{ position: 'absolute', top: '-10px', right: '-10px', fontSize: '4.5rem', opacity: 0.1 }}>🏢</div>
                    <h3 style={{ margin: '0 0 0.25rem 0', color: '#3b82f6', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.1rem' }}>
                      För press, samarbeten och övriga frågor
                    </h3>
                    <ul style={{ margin: '0.5rem 0 1rem 0', paddingLeft: '1.5rem', color: '#e2e8f0', display: 'flex', flexDirection: 'column', gap: '0.2rem', fontSize: '0.9rem' }}>
                      <li>Vi vill skriva om er i tidningen</li>
                      <li>Vi vill samarbeta</li>
                      <li>Kan ni sponsra vårt event?</li>
                    </ul>
                    <a href="mailto:info@smartekonomi.nu" style={{ 
                      display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
                      background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                      color: '#fff', textDecoration: 'none', padding: '0.6rem 1.2rem',
                      borderRadius: '8px', fontWeight: 'bold', boxShadow: '0 4px 15px rgba(59, 130, 246, 0.3)',
                      fontSize: '0.95rem'
                    }}>
                      ✉️ info@smartekonomi.nu
                    </a>
                  </div>
                  
                  {visibility.company && (
                    <div style={{ marginTop: '0.25rem', fontSize: '0.8rem', color: 'var(--text-secondary)', textAlign: 'center', lineHeight: '1.4' }}>
                      <strong style={{ color: '#fff', fontSize: '0.9rem' }}>{contactInfo.company}</strong>
                      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '0.5rem 1rem', marginTop: '0.2rem' }}>
                        {visibility.orgnr && <span>Org.nr: {contactInfo.orgnr}</span>}
                        {visibility.vat && <span>VAT: {contactInfo.vat}</span>}
                      </div>
                      {visibility.address && <div style={{ marginTop: '0.2rem' }}>Säte: {contactInfo.address}</div>}
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {type === 'faq' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <p style={{ color: 'var(--text-secondary)', marginTop: '-0.5rem', marginBottom: '0.5rem' }}>
                Här hittar du snabba svar om hur SmartEkonomi fungerar.
              </p>
              
              {faqs.map((group, groupIndex) => (
                <div key={groupIndex} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <h3 style={{ color: '#fff', fontSize: '1.1rem', margin: '0 0 0.5rem 0' }}>{group.category}</h3>
                  {group.questions.map((item, qIndex) => {
                    const index = groupIndex * 100 + qIndex; // unikt id
                    const isOpen = openFaqIndex === index;
                    return (
                      <div 
                        key={qIndex} 
                        style={{ 
                          background: 'rgba(255,255,255,0.05)', 
                          borderRadius: '8px', 
                          overflow: 'hidden',
                          border: '1px solid rgba(255,255,255,0.1)'
                        }}
                      >
                        <button
                          onClick={() => setOpenFaqIndex(isOpen ? null : index)}
                          style={{
                            width: '100%',
                            padding: '1rem',
                            background: 'transparent',
                            border: 'none',
                            color: '#fff',
                            fontWeight: 'bold',
                            fontSize: '0.95rem',
                            textAlign: 'left',
                            cursor: 'pointer',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                          }}
                        >
                          <span>{item.q}</span>
                          <span style={{ 
                            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', 
                            transition: 'transform 0.2s ease',
                            color: 'var(--text-secondary)'
                          }}>
                            ▼
                          </span>
                        </button>
                        <div style={{
                          maxHeight: isOpen ? '200px' : '0',
                          overflow: 'hidden',
                          transition: 'max-height 0.3s ease',
                          background: 'rgba(0,0,0,0.2)'
                        }}>
                          <div style={{ padding: '0 1rem 1rem 1rem', color: 'var(--text-secondary)', whiteSpace: 'pre-line' }}>
                            {item.a}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
