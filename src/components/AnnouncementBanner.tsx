import { Megaphone, Sparkles } from "lucide-react";

export function AnnouncementBanner() {
  return (
    <div className="flex items-center gap-3 py-2">

      <div className="flex shrink-0 items-center gap-2">
        {/* <Megaphone className="h-5 w-5 text-primary" /> */}
        </div>

      <div className="min-w-0 flex-1 overflow-hidden">
        <div className="announcement-marquee flex whitespace-nowrap">

          <div className="flex items-center gap-12 px-6">
            <span className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-gold" />
              🌱 Earn <strong>10 Reputation</strong> for every approved resource you upload.
            </span>

            <span>
              📚 Share lecture notes, past questions, project reports, and research materials with the community.
            </span>

            <span>
              ⭐ Increase your Reputation to unlock higher Contributor Levels.
            </span>

            <span>
              🏆 Reputation reflects your contribution and impact within Aneks Library.
            </span>

            <span>
              👑 Keep uploading quality resources to become an Elite Contributor.
            </span>

            <span>
              🚀 Premium members enjoy unlimited secure downloads and exclusive features.
            </span>
          </div>

          <div className="flex items-center gap-12 px-6">
            <span className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-gold" />
              🌱 Earn <strong>10 Reputation</strong> for every approved resource you upload.
            </span>

            <span>
              📚 Share lecture notes, past questions, project reports, and research materials with the community.
            </span>

            <span>
              ⭐ Increase your Reputation to unlock higher Contributor Levels.
            </span>

            <span>
              🏆 Reputation reflects your contribution and impact within Aneks Library.
            </span>

            <span>
              👑 Keep uploading quality resources to become an Elite Contributor.
            </span>

            <span>
              🚀 Premium members enjoy unlimited secure downloads and exclusive features.
            </span>
          </div>

        </div>
      </div>

    </div>
  );
}