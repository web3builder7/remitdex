import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight, Globe, Zap, Shield, DollarSign } from "lucide-react";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-b from-primary/5 to-background py-20 md:py-32">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-4xl text-center">
            <h1 className="mb-6 text-4xl font-bold tracking-tight sm:text-6xl">
              Send Money Home
              <span className="text-primary"> Instantly</span>
            </h1>
            <p className="mb-8 text-xl text-muted-foreground">
              Cross-chain remittance platform powered by Stellar and 1inch. 
              Send from any blockchain, receive in local currency in minutes.
            </p>
            <div className="flex flex-col gap-4 sm:flex-row sm:justify-center">
              <Link href="/send">
                <Button size="lg" className="w-full sm:w-auto">
                  Send Money Now
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Link href="/rates">
                <Button size="lg" variant="outline" className="w-full sm:w-auto">
                  Check Rates
                </Button>
              </Link>
            </div>
          </div>

          {/* Stats */}
          <div className="mx-auto mt-16 grid max-w-4xl grid-cols-2 gap-8 md:grid-cols-4">
            <div className="text-center">
              <div className="text-4xl font-bold text-primary">0.5%</div>
              <div className="mt-1 text-sm text-muted-foreground">Total Fees</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-primary">3-5s</div>
              <div className="mt-1 text-sm text-muted-foreground">Settlement Time</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-primary">50+</div>
              <div className="mt-1 text-sm text-muted-foreground">Countries</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-primary">24/7</div>
              <div className="mt-1 text-sm text-muted-foreground">Available</div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <h2 className="mb-12 text-center text-3xl font-bold">Why Choose RemitDEX?</h2>
          <div className="mx-auto grid max-w-5xl gap-8 md:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border bg-card p-6 text-card-foreground">
              <Globe className="mb-4 h-10 w-10 text-primary" />
              <h3 className="mb-2 text-lg font-semibold">Any Chain</h3>
              <p className="text-sm text-muted-foreground">
                Send from Ethereum, BSC, Polygon, or any supported blockchain
              </p>
            </div>
            <div className="rounded-lg border bg-card p-6 text-card-foreground">
              <Zap className="mb-4 h-10 w-10 text-primary" />
              <h3 className="mb-2 text-lg font-semibold">Lightning Fast</h3>
              <p className="text-sm text-muted-foreground">
                3-5 second settlement on Stellar, minutes to bank account
              </p>
            </div>
            <div className="rounded-lg border bg-card p-6 text-card-foreground">
              <Shield className="mb-4 h-10 w-10 text-primary" />
              <h3 className="mb-2 text-lg font-semibold">Secure</h3>
              <p className="text-sm text-muted-foreground">
                Atomic swaps with HTLC ensure your funds are always safe
              </p>
            </div>
            <div className="rounded-lg border bg-card p-6 text-card-foreground">
              <DollarSign className="mb-4 h-10 w-10 text-primary" />
              <h3 className="mb-2 text-lg font-semibold">Best Rates</h3>
              <p className="text-sm text-muted-foreground">
                1inch aggregation finds the best rates across all DEXs
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="bg-muted/50 py-20">
        <div className="container mx-auto px-4">
          <h2 className="mb-12 text-center text-3xl font-bold">How It Works</h2>
          <div className="mx-auto max-w-4xl">
            <div className="space-y-8">
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  1
                </div>
                <div>
                  <h3 className="mb-1 text-lg font-semibold">Choose Amount & Destination</h3>
                  <p className="text-muted-foreground">
                    Select your source chain, token, amount, and recipient country
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  2
                </div>
                <div>
                  <h3 className="mb-1 text-lg font-semibold">Get Instant Quote</h3>
                  <p className="text-muted-foreground">
                    See exact fees, exchange rate, and delivery time upfront
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  3
                </div>
                <div>
                  <h3 className="mb-1 text-lg font-semibold">Send Crypto</h3>
                  <p className="text-muted-foreground">
                    Approve transaction from your wallet - we handle the rest
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  4
                </div>
                <div>
                  <h3 className="mb-1 text-lg font-semibold">Recipient Gets Money</h3>
                  <p className="text-muted-foreground">
                    Funds delivered to bank account or mobile money in minutes
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-3xl rounded-lg bg-primary p-8 text-center text-primary-foreground md:p-12">
            <h2 className="mb-4 text-3xl font-bold">Ready to Send Money Home?</h2>
            <p className="mb-8 text-lg opacity-90">
              Join thousands saving on remittance fees with RemitDEX
            </p>
            <Link href="/send">
              <Button size="lg" variant="secondary">
                Start Sending Now
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}