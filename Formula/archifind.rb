class Archifind < Formula
  desc "Scan codebases and visualize architecture as an interactive graph"
  homepage "https://github.com/Mensa-Philosophical-Circle/archifind"
  url "https://github.com/Mensa-Philosophical-Circle/archifind/archive/7ce215de9fcc1bff64c0e10aa46f2508bc4842ef.tar.gz"
  version "1.0.0"
  sha256 "35b5aa17459aad98b5e1434a8f3705ace466f6d71400ea96df926b409cc04d15"
  license "ISC"

  depends_on "node"

  def install
    libexec.install Dir["*"]

    cd libexec do
      system "npm", "ci", "--no-audit", "--no-fund"
      system "npm", "--prefix", "ui", "ci", "--no-audit", "--no-fund"
      system "npm", "--prefix", "ui", "run", "build"
    end

    (bin / "archifind").write <<~EOS
      #!/bin/sh
      exec "#{Formula["node"].opt_bin}/node" "#{libexec}/src/cli.js" "$@"
    EOS
  end

  test do
    assert_match "archifind", shell_output("#{bin}/archifind --help")
  end
end