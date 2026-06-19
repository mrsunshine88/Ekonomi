import { useState, useEffect } from 'react';
import { useAuth } from '../AuthContext';
import { supabase } from '../supabase';

export default function TermsModal() {
  const { acceptTos, tosAccepted, user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [checkedTos, setCheckedTos] = useState(false);
  const [checkedPrivacy, setCheckedPrivacy] = useState(false);
  const [activeTab, setActiveTab] = useState<'tos' | 'privacy'>('tos');
  const [contactInfo, setContactInfo] = useState({ company: 'SmartEkonomi AB', email: 'info@exempel.se' });

  useEffect(() => {
    const fetchContactInfo = async () => {
      const { data } = await supabase.from('global_settings').select('key, value');
      if (data) {
        setContactInfo({
          company: data.find(d => d.key === 'contact_company')?.value || 'SmartEkonomi AB',
          email: data.find(d => d.key === 'contact_email')?.value || 'info@exempel.se'
        });
      }
    };
    fetchContactInfo();
  }, []);

  if (!user || tosAccepted) return null;

  const handleAccept = async () => {
    if (!checkedTos || !checkedPrivacy) return;
    setLoading(true);
    await acceptTos();
    setLoading(false);
  };

  return (
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
        boxShadow: '0 20px 40px rgba(0,0,0,0.8)' 
      }}>
        <h2 style={{ color: '#fff', fontSize: '1.8rem', marginBottom: '1rem', textAlign: 'center' }}>
          Välkommen till SmartEkonomi!
        </h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', textAlign: 'center' }}>
          För att fortsätta behöver du läsa och godkänna våra villkor.
        </p>

        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem' }}>
          <button 
            onClick={() => setActiveTab('tos')}
            style={{ 
              background: 'transparent', border: 'none', color: activeTab === 'tos' ? '#fff' : 'var(--text-secondary)', 
              fontWeight: activeTab === 'tos' ? 'bold' : 'normal', cursor: 'pointer', padding: '0.5rem',
              borderBottom: activeTab === 'tos' ? '2px solid var(--accent-color)' : '2px solid transparent'
            }}
          >
            Användarvillkor
          </button>
          <button 
            onClick={() => setActiveTab('privacy')}
            style={{ 
              background: 'transparent', border: 'none', color: activeTab === 'privacy' ? '#fff' : 'var(--text-secondary)', 
              fontWeight: activeTab === 'privacy' ? 'bold' : 'normal', cursor: 'pointer', padding: '0.5rem',
              borderBottom: activeTab === 'privacy' ? '2px solid var(--accent-color)' : '2px solid transparent'
            }}
          >
            Integritetspolicy
          </button>
        </div>

        <div style={{ background: 'rgba(0,0,0,0.3)', padding: '1.5rem', borderRadius: '8px', marginBottom: '2rem', color: '#ccc', fontSize: '0.95rem', lineHeight: '1.6' }}>
          {activeTab === 'tos' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <h3 style={{ color: '#fff', marginBottom: '0.5rem', marginTop: 0 }}>Användarvillkor (Terms of Service)</h3>
              <p>
                Genom att skapa ett konto godkänner du dessa användarvillkor och vår integritetspolicy.
              </p>
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
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <h3 style={{ color: '#fff', marginBottom: '0.5rem', marginTop: 0 }}>Integritetspolicy (GDPR)</h3>
              <p>
                Genom att skapa ett konto godkänner du dessa användarvillkor och vår integritetspolicy.
              </p>
              <p>
                <strong style={{ color: '#fff' }}>Personuppgiftsansvarig:</strong> {contactInfo.company} ({contactInfo.email}) är personuppgiftsansvarig för behandlingen av dina uppgifter i appen.
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
                <strong style={{ color: '#fff' }}>Datalagring & Säkerhet:</strong> All data lagras på molnservrar inom EU/EES för att uppfylla strikta europeiska dataskyddskrav. All kommunikation mellan appen och våra servrar krypteras (SSL/TLS). I databasen skyddas din information av en strikt säkerhetsmodell (Row Level Security), vilket säkerställer att endast behöriga användare inom hushållet samt systemadministratörer (när det krävs för drift och support) kan komma åt era ekonomiska siffror.
              </p>
              <p>
                <strong style={{ color: '#fff' }}>Dina rättigheter & Rätten att bli glömd:</strong> Du äger din data. Din data behålls endast så länge du är en aktiv användare eller prenumerant. Raderar du ditt konto i appen försvinner all din relaterade data permanent från vår databas utan onödig fördröjning. Du har även rätt att begära utdrag av din data, och rätt att lämna klagomål till Integritetsskyddsmyndigheten (IMY).
              </p>
              <p>
                <strong style={{ color: '#fff' }}>Cookies:</strong> Vi använder nödvändiga kakor (cookies/localstorage) uteslutande för att hålla dig inloggad och komma ihåg dina val (t.ex. att du sett välkomstrutan). Vi använder inga spårningscookies för tredjepartsreklam.
              </p>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2rem' }}>
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', cursor: 'pointer', color: '#fff' }}>
            <input 
              type="checkbox" 
              checked={checkedTos} 
              onChange={e => setCheckedTos(e.target.checked)}
              style={{ width: '20px', height: '20px', accentColor: 'var(--accent-color)', marginTop: '0.2rem' }}
            />
            <span style={{ fontSize: '0.95rem', lineHeight: '1.4' }}>
              Jag har läst och godkänner <strong>Användarvillkoren</strong>.
            </span>
          </label>
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', cursor: 'pointer', color: '#fff' }}>
            <input 
              type="checkbox" 
              checked={checkedPrivacy} 
              onChange={e => setCheckedPrivacy(e.target.checked)}
              style={{ width: '20px', height: '20px', accentColor: 'var(--accent-color)', marginTop: '0.2rem' }}
            />
            <span style={{ fontSize: '0.95rem', lineHeight: '1.4' }}>
              Jag har läst och godkänner <strong>Integritetspolicyn</strong>.
            </span>
          </label>
        </div>

        <button 
          onClick={handleAccept}
          disabled={!checkedTos || !checkedPrivacy || loading}
          style={{ 
            background: (checkedTos && checkedPrivacy) ? 'var(--accent-gradient)' : 'rgba(255,255,255,0.1)', 
            color: (checkedTos && checkedPrivacy) ? '#fff' : 'var(--text-secondary)', 
            padding: '1rem 2rem', 
            border: 'none', 
            borderRadius: '8px', 
            cursor: (checkedTos && checkedPrivacy) ? 'pointer' : 'not-allowed', 
            fontWeight: 'bold', 
            fontSize: '1.1rem', 
            width: '100%',
            transition: 'all 0.2s'
          }}
        >
          {loading ? 'Sparar...' : 'Jag godkänner, ta mig till appen'}
        </button>
      </div>
    </div>
  );
}
