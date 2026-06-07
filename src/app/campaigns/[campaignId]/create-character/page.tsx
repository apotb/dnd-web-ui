import { CharacterCreator } from "@/components/character-creator/character-creator";

export default async function CreateCharacterPage({
  params,
}: {
  params: Promise<{ campaignId: string }>;
}) {
  const { campaignId } = await params;

  return (
    <div>
      <h2 className="page-title">New Character</h2>
      <div className="retro-note creator-intro">
        <p>
          For whatever reason you determine, your character has decided to come to the distant
          land of Chult. After docking in Port Nyanzaru, it becomes clear you are not the only
          one to have this idea. The city is packed at all times of day and stays busy well into
          the night. Dozens of ships arrive and depart every day. With all the people clamoring
          for work, any job opportunity seems like a good one.
        </p>
        <p>
          As you pass by the taverns, you see a sign posted on a nearby wall:
        </p>
        <blockquote className="creator-intro-sign">
          <p>BODYGUARDS NEEDED</p>
          <p>
            Private memorial service. Four capable individuals required.
          </p>
          <p>Expected duties:</p>
          <ul>
            <li>Crowd control</li>
            <li>Estate security</li>
            <li>Protection of mourners</li>
            <li>Discretion regarding the deceased</li>
          </ul>
          <p>Bonus pay if violence occurs.</p>
          <p>No questions asked.</p>
          <p>
            Report to Kaya&apos;s House of Repose by sunset.
            <br />
            Ask for Kwalu.
          </p>
        </blockquote>
        <p>Think about these questions when designing your character:</p>
        <ol className="creator-intro-questions">
          <li>What brought you to Port Nyanzaru?</li>
          <li>Why would you accept this sketchy job?</li>
        </ol>
      </div>
      <CharacterCreator campaignId={campaignId} />
    </div>
  );
}
